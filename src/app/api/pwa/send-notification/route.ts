// app/api/pwa/send-notification/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import webpush from "web-push";
import { resend } from "@/lib/services";

// Initialize VAPID keys for web push
webpush.setVapidDetails(
  "mailto:notifs@worldsamma.org",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

const PRIORITY_CONFIG = {
  normal: {
    sendPush: true,
    sendEmail: false,
    requireInteraction: false,
    vibrate: [200, 100, 200],
    ttl: 86400,
  },
  urgent: {
    sendPush: true,
    sendEmail: true,
    requireInteraction: false,
    vibrate: [300, 150, 300, 150, 300],
    ttl: 43200,
  },
  announcement: {
    sendPush: true,
    sendEmail: true,
    requireInteraction: true,
    vibrate: [500, 200, 500],
    ttl: 604800,
  },
};

export async function POST(request: Request) {
  try {
    const { message, chatroomId, priority = "normal" } = await request.json();

    const supabase = await createClient();

    // Get chatroom details
    const { data: chatroom } = await supabase
      .from("chatrooms")
      .select("id, title, type")
      .eq("id", chatroomId)
      .single();

    if (!chatroom) {
      return NextResponse.json(
        { error: "Chatroom not found" },
        { status: 404 },
      );
    }

    // Get ALL members of this chatroom (except the sender)
    const { data: members } = await supabase
      .from("chatroom_members")
      .select(
        `
        user_id,
        users_profile!inner (
          id,
          email,
          full_name,
          language,
          email_notifications_enabled,
          push_notifications_enabled
        )
      `,
      )
      .eq("chatroom_id", chatroomId)
      .neq("user_id", message.user_id);

    if (!members || members.length === 0) {
      return NextResponse.json({ message: "No members to notify" });
    }

    const config =
      PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG] ||
      PRIORITY_CONFIG.normal;

    // Process notifications
    const results = {
      pushSent: 0,
      emailsSent: 0,
      errors: 0,
    };

    // Process members
    for (const member of members) {
      const user = member.users_profile[0];

      // Skip if user has disabled notifications
      if (user.push_notifications_enabled === false && config.sendPush) {
        continue;
      }

      try {
        // 1. Send Push Notification (if enabled)
        if (config.sendPush && user.push_notifications_enabled !== false) {
          const pushSent = await sendPushNotifications(
            supabase,
            user.id,
            message,
            chatroom,
            priority,
            config,
          );
          if (pushSent) results.pushSent++;
        }

        // 2. Send Email via Resend (for urgent/announcement messages)
        if (config.sendEmail && user.email_notifications_enabled !== false) {
          const emailSent = await sendEmailViaResend(
            user,
            message,
            chatroom,
            priority,
          );
          if (emailSent) results.emailsSent++;
        }
      } catch (error) {
        console.error(`Failed to notify user ${user.id}:`, error);
        results.errors++;
      }
    }

    // Update broadcast tracking in database
    await supabase
      .from("messages")
      .update({
        is_broadcast: true,
        broadcast_sent_at: new Date().toISOString(),
        broadcast_stats: {
          total_members: members.length,
          push_sent: results.pushSent,
          emails_sent: results.emailsSent,
          errors: results.errors,
        },
      })
      .eq("id", message.id);

    return NextResponse.json({
      success: true,
      priority,
      stats: {
        totalMembers: members.length,
        ...results,
      },
    });
  } catch (error) {
    console.error("Broadcast notification error:", error);
    return NextResponse.json(
      { error: "Failed to send broadcast notifications" },
      { status: 500 },
    );
  }
}

// Helper: Send push notifications to a single user's devices
async function sendPushNotifications(
  supabase: any,
  userId: string,
  message: any,
  chatroom: any,
  priority: string,
  config: any,
): Promise<boolean> {
  try {
    // Get user's push subscriptions
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId);

    if (!subscriptions || subscriptions.length === 0) {
      return false;
    }

    // Create priority-based title prefix
    let titlePrefix = "";
    let urgencyLevel = "normal";

    if (priority === "urgent") {
      titlePrefix = "🔴 URGENT BROADCAST: ";
      urgencyLevel = "high";
    } else if (priority === "announcement") {
      titlePrefix = "📢 ANNOUNCEMENT: ";
      urgencyLevel = "high";
    }

    const payload = JSON.stringify({
      title: `${titlePrefix}${chatroom.title}`,
      body:
        message.content.length > 100
          ? `${message.content.substring(0, 100)}...`
          : message.content,
      icon: message.user_avatar || "/icons/icon-192x192.png",
      badge: "/icons/badge-72x72.png",
      tag: `broadcast-${chatroom.id}-${message.id}`,
      url: `/chatrooms/${chatroom.id}?messageId=${message.id}`,
      messageId: message.id,
      chatroomId: chatroom.id,
      priority: priority,
      isBroadcast: true,
    });

    // Send to all subscribed devices
    const notifications = subscriptions.map(async (sub: any) => {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        await webpush.sendNotification(pushSubscription, payload, {
          TTL: config.ttl,
          urgency: urgencyLevel as any,
        });

        // Update last notification timestamp
        await supabase
          .from("push_subscriptions")
          .update({ last_notification_at: new Date().toISOString() })
          .eq("endpoint", sub.endpoint);
      } catch (error: any) {
        if (error.statusCode === 410) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", sub.endpoint);
        }
        throw error;
      }
    });

    await Promise.all(notifications);
    return true;
  } catch (error) {
    console.error(`Error sending push to user ${userId}:`, error);
    return false;
  }
}

// Helper: Send email via Resend
async function sendEmailViaResend(
  user: any,
  message: any,
  chatroom: any,
  priority: string,
): Promise<boolean> {
  try {
    // Generate email HTML based on priority
    const html = generateBroadcastEmailHTML(user, message, chatroom, priority);

    // Determine subject line based on priority
    let subject = "";
    if (priority === "urgent") {
      subject = `🔴 URGENT BROADCAST: ${chatroom.title}`;
    } else if (priority === "announcement") {
      subject = `📢 ANNOUNCEMENT: ${chatroom.title}`;
    } else {
      subject = `New broadcast in ${chatroom.title}`;
    }

    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: "WSF Chat <notifications@noreply.worldsamma.org>",
      to: [user.email],
      subject: subject,
      html: html,
      replyTo: "support@worldsamma.org",
      // Add tags for better tracking
      headers: {
        "X-Priority":
          priority === "urgent" ? "1" : priority === "announcement" ? "2" : "3",
      },
    });

    if (error) {
      console.error(`Resend error for ${user.email}:`, error);
      return false;
    }

    console.log(
      `Email sent to ${user.email} (${priority} broadcast) - ID: ${data?.id}`,
    );
    return true;
  } catch (error) {
    console.error(`Failed to send email to ${user.email}:`, error);
    return false;
  }
}

// Helper: Generate broadcast email HTML
function generateBroadcastEmailHTML(
  user: any,
  message: any,
  chatroom: any,
  priority: string,
): string {
  const priorityColor =
    priority === "urgent"
      ? "#dc2626"
      : priority === "announcement"
        ? "#f59e0b"
        : "#4f46e5";

  const priorityIcon =
    priority === "urgent" ? "🔴" : priority === "announcement" ? "📢" : "📣";

  const priorityText =
    priority === "urgent"
      ? "URGENT BROADCAST"
      : priority === "announcement"
        ? "ANNOUNCEMENT"
        : "New Broadcast";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${priorityText} from ${chatroom.title}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          margin: 0;
          padding: 0;
          background: #f3f4f6;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: ${priorityColor};
          color: white;
          padding: 30px 20px;
          text-align: center;
          border-radius: 12px 12px 0 0;
        }
        .content {
          background: white;
          padding: 30px;
          border-radius: 0 0 12px 12px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .message {
          background: #f9fafb;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
          border-left: 4px solid ${priorityColor};
          white-space: pre-wrap;
          word-wrap: break-word;
        }
        .button {
          display: inline-block;
          background: ${priorityColor};
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 6px;
          margin: 20px 0;
          font-weight: 600;
        }
        .button:hover {
          opacity: 0.9;
        }
        .footer {
          text-align: center;
          padding: 20px;
          font-size: 12px;
          color: #6b7280;
          border-top: 1px solid #e5e7eb;
          margin-top: 20px;
        }
        .badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 16px;
        }
        .badge-urgent {
          background: #fee2e2;
          color: #dc2626;
        }
        .badge-announcement {
          background: #fef3c7;
          color: #d97706;
        }
        .badge-normal {
          background: #e0e7ff;
          color: #4f46e5;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
          font-size: 14px;
        }
        .label {
          font-weight: 600;
          color: #4b5563;
        }
        .value {
          color: #6b7280;
        }
        @media only screen and (max-width: 480px) {
          .container {
            padding: 10px;
          }
          .content {
            padding: 20px;
          }
          .button {
            display: block;
            text-align: center;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div style="font-size: 48px; margin-bottom: 10px;">${priorityIcon}</div>
          <h1 style="margin: 10px 0 0; font-size: 28px;">${priorityText}</h1>
          <p style="margin: 10px 0 0; opacity: 0.9;">${chatroom.title}</p>
        </div>
        
        <div class="content">
          <div class="badge ${
            priority === "urgent"
              ? "badge-urgent"
              : priority === "announcement"
                ? "badge-announcement"
                : "badge-normal"
          }">
            ${priority === "urgent" ? "⚠️ Immediate Attention Required" : priority === "announcement" ? "📢 Official Announcement" : "📣 Community Broadcast"}
          </div>
          
          <div class="info-row">
            <span class="label">From:</span>
            <span class="value">${message.user_name}</span>
          </div>
          
          <div class="info-row">
            <span class="label">Chatroom:</span>
            <span class="value">${chatroom.title}</span>
          </div>
          
          <div class="info-row">
            <span class="label">Time:</span>
            <span class="value">${new Date().toLocaleString()}</span>
          </div>
          
          <div style="margin: 25px 0 15px;">
            <strong style="font-size: 16px;">Message:</strong>
          </div>
          
          <div class="message">
            ${message.content.replace(/\n/g, "<br/>")}
          </div>
          
          <div style="text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/chatrooms/${chatroom.id}?messageId=${message.id}" 
               class="button">
              View Full Conversation →
            </a>
          </div>
          
          ${
            priority === "urgent"
              ? `
            <div style="background: #fee2e2; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <strong style="color: #dc2626;">⚠️ This is an urgent broadcast that requires your attention.</strong>
            </div>
          `
              : ""
          }
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;" />
          
          <p style="font-size: 14px; color: #6b7280; margin: 0;">
            You received this email because you are a member of <strong>${chatroom.title}</strong> on WSF Chat.
            To manage your notification preferences, visit your 
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/settings/notifications" style="color: ${priorityColor};">
              notification settings
            </a>.
          </p>
        </div>
        
        <div class="footer">
          <p style="margin: 0 0 5px;">&copy; ${new Date().getFullYear()} World Sama Federation. All rights reserved.</p>
          <p style="margin: 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/pwa/unsubscribe?email=${user.email}" style="color: #6b7280; text-decoration: none;">
              Unsubscribe from broadcast emails
            </a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}
