// components/chatrooms/UnreadMessagesDialog.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageCircle,
  Users,
  Globe,
  Lock,
  Clock,
  ChevronRight,
  Inbox,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/lib/context/AuthContext";
import { getInitials } from "@/lib/utils";
import { toast } from "sonner";

interface UnreadChatroom {
  chatroomId: string;
  chatroomTitle: string;
  chatroomType: string;
  unreadCount: number;
  lastMessage: {
    content: string;
    created_at: string;
    user_name: string;
    user_avatar?: string;
  } | null;
}

interface UnreadMessagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChatroomClick?: (chatroomId: string) => void;
}

export function UnreadMessagesDialog({
  open,
  onOpenChange,
  onChatroomClick,
}: UnreadMessagesDialogProps) {
  const router = useRouter();
  const { profile, supabase } = useAuth();
  const [unreadChatrooms, setUnreadChatrooms] = useState<UnreadChatroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastReadTimestamps, setLastReadTimestamps] = useState<
    Record<string, string>
  >({});

  // Load last read timestamps
  const loadLastReadTimestamps = async () => {
    if (!profile?.id) return;

    const stored = localStorage.getItem(`chat-last-read-${profile.id}`);
    if (stored) {
      setLastReadTimestamps(JSON.parse(stored));
    }

    const { data } = await supabase
      .from("user_chatroom_last_read")
      .select("chatroom_id, last_read_at")
      .eq("user_id", profile.id);

    if (data && data.length > 0) {
      const dbTimestamps: Record<string, string> = {};
      data.forEach((item) => {
        dbTimestamps[item.chatroom_id] = item.last_read_at;
      });
      const merged = { ...lastReadTimestamps, ...dbTimestamps };
      setLastReadTimestamps(merged);
      localStorage.setItem(
        `chat-last-read-${profile.id}`,
        JSON.stringify(merged),
      );
    }
  };

  // Fetch unread messages per chatroom
  const fetchUnreadMessages = async () => {
    if (!profile?.id || !supabase) return;

    setLoading(true);
    try {
      // Get all chatrooms the user is a member of
      const { data: memberships, error: membersError } = await supabase
        .from("chatroom_members")
        .select(
          `
        chatroom_id,
        chatrooms:chatroom_id (
          id,
          title,
          type
        )
      `,
        )
        .eq("user_id", profile.id);

      if (membersError) throw membersError;
      if (!memberships || memberships.length === 0) {
        setUnreadChatrooms([]);
        setLoading(false);
        return;
      }

      const unreadData: UnreadChatroom[] = [];

      for (const membership of memberships) {
        const chatroom = membership.chatrooms as any;
        const lastRead = lastReadTimestamps[chatroom.id];

        // Count unread messages
        let query = supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("chatroom_id", chatroom.id)
          .neq("user_id", profile.id);

        if (lastRead) {
          query = query.gt("created_at", lastRead);
        }

        const { count: unreadCount, error: countError } = await query;

        if (countError) {
          console.error(
            `Error counting messages for ${chatroom.id}:`,
            countError,
          );
          continue;
        }

        if (!unreadCount || unreadCount === 0) {
          continue;
        }

        // Get last message for preview - FIXED VERSION
        const { data: lastMsg, error: lastMsgError } = await supabase
          .from("messages")
          .select(
            `
          content,
          created_at,
          user_id
        `,
          )
          .eq("chatroom_id", chatroom.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (lastMsgError && lastMsgError.code !== "PGRST116") {
          console.error(
            `Error getting last message for ${chatroom.id}:`,
            lastMsgError,
          );
        }

        let userName = "User";
        let userAvatar = undefined;

        // Fetch user profile separately if we have a user_id
        if (lastMsg?.user_id) {
          const { data: userProfile, error: profileError } = await supabase
            .from("users_profile")
            .select("full_name, avatar_url")
            .eq("id", lastMsg.user_id)
            .single();

          if (!profileError && userProfile) {
            userName = userProfile.full_name || "User";
            userAvatar = userProfile.avatar_url;
          }
        }

        unreadData.push({
          chatroomId: chatroom.id,
          chatroomTitle: chatroom.title,
          chatroomType: chatroom.type,
          unreadCount: unreadCount,
          lastMessage: lastMsg
            ? {
                content: lastMsg.content,
                created_at: lastMsg.created_at,
                user_name: userName,
                user_avatar: userAvatar,
              }
            : null,
        });
      }

      // Sort by unread count (highest first)
      unreadData.sort((a, b) => b.unreadCount - a.unreadCount);
      setUnreadChatrooms(unreadData);
    } catch (error) {
      console.error("Error fetching unread messages:", error);
      toast.error("Failed to load unread messages");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && profile?.id) {
      loadLastReadTimestamps();
      fetchUnreadMessages();
    }
  }, [open, profile?.id]);

  const handleChatroomClick = (chatroomId: string) => {
    onOpenChange(false);
    if (onChatroomClick) {
      onChatroomClick(chatroomId);
    } else {
      router.push(`/chatrooms/${chatroomId}`);
    }
  };

  const getChatroomIcon = (type: string) => {
    switch (type) {
      case "global":
        return <Globe className="h-4 w-4" />;
      case "private":
        return <Lock className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  const totalUnread = unreadChatrooms.reduce(
    (sum, c) => sum + c.unreadCount,
    0,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-primary" />
              Unread Messages
            </span>
            <Badge variant="secondary" className="text-sm">
              {totalUnread} total
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {unreadChatrooms.length} chatroom
            {unreadChatrooms.length !== 1 ? "s" : ""} with unread messages
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4 overflow-auto">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-6 w-8 rounded-full" />
                </div>
              ))}
            </div>
          ) : unreadChatrooms.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <MessageCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No unread messages</p>
              <p className="text-sm text-muted-foreground mt-1">
                All caught up! 🎉
              </p>
            </div>
          ) : (
            <div className="space-y-2 overflow-auto">
              {unreadChatrooms.map((chatroom) => (
                <button
                  key={chatroom.chatroomId}
                  onClick={() => handleChatroomClick(chatroom.chatroomId)}
                  className="w-full text-left p-3 rounded-lg hover:bg-muted/50 transition-all duration-200 group"
                >
                  <div className="flex items-start gap-3">
                    {/* Chatroom Icon */}
                    <div className="flex-shrink-0 mt-1">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        {getChatroomIcon(chatroom.chatroomType)}
                      </div>
                    </div>

                    {/* Chatroom Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-sm truncate">
                          {chatroom.chatroomTitle}
                        </h4>
                        <Badge
                          variant="outline"
                          className="text-xs flex-shrink-0"
                        >
                          {chatroom.unreadCount} new
                        </Badge>
                      </div>

                      {/* Last Message Preview */}
                      {chatroom.lastMessage && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-medium truncate max-w-[100px]">
                              {chatroom.lastMessage.user_name}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1 flex-shrink-0">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(
                                new Date(chatroom.lastMessage.created_at),
                                { addSuffix: true },
                              )}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {chatroom.lastMessage.content.length > 80
                              ? `${chatroom.lastMessage.content.substring(0, 80)}...`
                              : chatroom.lastMessage.content}
                          </p>
                        </div>
                      )}

                      {!chatroom.lastMessage && (
                        <p className="text-sm text-muted-foreground italic">
                          No messages yet
                        </p>
                      )}
                    </div>

                    {/* Chevron */}
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer with Mark All as Read button */}
        {unreadChatrooms.length > 0 && (
          <div className="px-6 py-3 border-t bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground hover:text-foreground"
              onClick={async () => {
                // Mark all as read
                for (const chatroom of unreadChatrooms) {
                  const now = new Date().toISOString();
                  await supabase.from("user_chatroom_last_read").upsert({
                    user_id: profile?.id,
                    chatroom_id: chatroom.chatroomId,
                    last_read_at: now,
                    updated_at: now,
                  });
                }
                // Refresh the list
                await fetchUnreadMessages();
                toast.success("All messages marked as read");
              }}
            >
              Mark all as read
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
