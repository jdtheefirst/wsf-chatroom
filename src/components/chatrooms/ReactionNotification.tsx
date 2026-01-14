// components/chatrooms/ReactionNotification.tsx
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

interface ReactionNotificationProps {
  supabase: any;
  profileId: string;
  playMessageSound: () => void;
}

export function ReactionNotification({
  supabase,
  profileId,
  playMessageSound,
}: ReactionNotificationProps) {
  const [processedReactions, setProcessedReactions] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    if (!supabase || !profileId) return;

    // Subscribe to message_reactions INSERT events
    const channel = supabase
      .channel("realtime:user_reactions")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_reactions",
          filter: `user_id=neq.${profileId}`, // Only reactions from others
        },
        async (payload: any) => {
          const reaction = payload.new as any;

          // Skip if we already processed this reaction
          const reactionKey = `${reaction.message_id}-${reaction.user_id}-${reaction.emoji}`;
          if (processedReactions.has(reactionKey)) {
            return;
          }

          setProcessedReactions((prev) => new Set([...prev, reactionKey]));

          try {
            // Fetch the message that was reacted to
            const { data: message } = await supabase
              .from("messages")
              .select(
                `
                *,
                user_profile:users_profile!messages_user_id_fkey (
                  id, full_name, admission_no, avatar_url
                )
              `
              )
              .eq("id", reaction.message_id)
              .single();

            // Check if this reaction is on the current user's message
            if (message && message.user_id === profileId) {
              // Fetch the reactor's profile
              const { data: reactorProfile } = await supabase
                .from("users_profile")
                .select("full_name, avatar_url, belt_level")
                .eq("id", reaction.user_id)
                .single();

              const reactorName = reactorProfile?.full_name || "Someone";
              const emoji = reaction.emoji;

              // Show notification
              const notificationId = toast.success(
                <div className="flex items-center gap-2">
                  <span className="text-xl">{emoji}</span>
                  <div>
                    <p className="font-medium">
                      {reactorName} reacted to your message
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {message.content.length > 50
                        ? `${message.content.substring(0, 50)}...`
                        : message.content}
                    </p>
                  </div>
                </div>,
                {
                  id: reactionKey,
                  duration: 5000,
                  action: {
                    label: "View",
                    onClick: () => {
                      // Scroll to the message
                      const messageElement = document.getElementById(
                        `message-${message.id}`
                      );
                      if (messageElement) {
                        messageElement.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                        messageElement.classList.add("highlight-pulse");
                        setTimeout(() => {
                          messageElement.classList.remove("highlight-pulse");
                        }, 2000);
                      }
                    },
                  },
                }
              );

              // Play sound
              playMessageSound();

              // Browser notification
              if (document.hidden && "Notification" in window) {
                if (Notification.permission === "granted") {
                  new Notification(
                    `❤️ ${reactorName} reacted to your message`,
                    {
                      body: `${emoji} • ${message.content.substring(
                        0,
                        100
                      )}...`,
                      icon: reactorProfile?.avatar_url || "/default-avatar.png",
                      tag: `reaction-${reaction.message_id}`,
                      requireInteraction: false,
                      silent: false,
                    } as any
                  );
                }
              }

              // Clean up processed reaction after 10 seconds
              setTimeout(() => {
                setProcessedReactions((prev) => {
                  const newSet = new Set(prev);
                  newSet.delete(reactionKey);
                  return newSet;
                });
              }, 10000);
            }
          } catch (error) {
            console.error("Error processing reaction notification:", error);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, profileId, processedReactions, playMessageSound]);

  return null; // This is a notification-only component
}
