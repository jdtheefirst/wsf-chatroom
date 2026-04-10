// app/api/unsubscribe/route.ts
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email) {
    return new Response("Email parameter required", { status: 400 });
  }

  const supabase = await createClient();

  // Update user's email notification preference
  const { error } = await supabase
    .from("users_profile")
    .update({ email_notifications_enabled: false })
    .eq("email", email);

  if (error) {
    console.error("Unsubscribe error:", error);
    return new Response("Failed to unsubscribe", { status: 500 });
  }

  // Return a simple HTML page confirming unsubscribe
  return new Response(
    `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Unsubscribed - WSF Chat</title>
      <style>
        body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f3f4f6; }
        .card { background: white; padding: 40px; border-radius: 12px; text-align: center; max-width: 400px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #4f46e5; margin-bottom: 16px; }
        p { color: #6b7280; margin-bottom: 24px; }
        .button { display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>✅ Unsubscribed Successfully</h1>
        <p>You will no longer receive broadcast emails from WSF Chat.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}" class="button">Return to WSF Chat</a>
      </div>
    </body>
    </html>
  `,
    {
      headers: {
        "Content-Type": "text/html",
      },
    },
  );
}
