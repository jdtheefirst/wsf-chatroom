// components/chatrooms/PrivateReplyNotification.tsx
"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/context/AuthContext";
import { Shield } from "lucide-react";

type Props = {
  supabase: any;
  profileId: string;
};

export function PrivateReplyNotification({ supabase, profileId }: Props) {
  useEffect(() => {
    if (!supabase || !profileId) return;

    // Listen for new private replies
    const channel = supabase
      .channel(`private-replies:${profileId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `reply_is_private=eq.true`,
        },
        async (payload: any) => {
          const newMessage = payload.new as any;

          // Check if this private reply is for the current user
          if (newMessage.reply_to) {
            const { data: repliedMessage } = await supabase
              .from("messages")
              .select("user_id")
              .eq("id", newMessage.reply_to)
              .single();

            if (repliedMessage && repliedMessage.user_id === profileId) {
              // Fetch sender info
              const { data: senderProfile } = await supabase
                .from("users_profile")
                .select("full_name, avatar_url")
                .eq("id", newMessage.user_id)
                .single();

              toast.info("New private reply", {
                description: `${senderProfile?.full_name || "Someone"} sent you a private reply`,
                icon: <Shield className="h-5 w-5 text-purple-500" />,
                duration: 5000,
                action: {
                  label: "View",
                  onClick: () => {
                    // Scroll to the message
                    const messageElement = document.getElementById(
                      `message-${newMessage.id}`,
                    );
                    if (messageElement) {
                      messageElement.scrollIntoView({ behavior: "smooth" });
                      messageElement.classList.add("highlight-pulse");
                      setTimeout(() => {
                        messageElement.classList.remove("highlight-pulse");
                      }, 2000);
                    }
                  },
                },
              });
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, profileId]);

  return null;
}
