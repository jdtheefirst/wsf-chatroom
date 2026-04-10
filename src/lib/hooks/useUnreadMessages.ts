// lib/hooks/useTotalUnreadCount.ts
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/context/AuthContext";

export function useTotalUnreadCount() {
  const { profile, supabase } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastReadTimestamps, setLastReadTimestamps] = useState<
    Record<string, string>
  >({});

  // Load last read timestamps
  const loadLastReadTimestamps = async () => {
    if (!profile?.id) return;

    // Try localStorage first
    const stored = localStorage.getItem(`chat-last-read-${profile.id}`);
    if (stored) {
      setLastReadTimestamps(JSON.parse(stored));
    }

    // Sync with database
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

  // Calculate total unread messages across ALL chatrooms
  const calculateTotalUnread = async () => {
    if (!profile?.id || !supabase) return 0;

    try {
      // Get all chatrooms the user is a member of
      const { data: memberships } = await supabase
        .from("chatroom_members")
        .select("chatroom_id")
        .eq("user_id", profile.id);

      if (!memberships || memberships.length === 0) return 0;

      const chatroomIds = memberships.map((m) => m.chatroom_id);

      let totalUnread = 0;

      // For each chatroom, count messages newer than last read
      for (const chatroomId of chatroomIds) {
        const lastRead = lastReadTimestamps[chatroomId];

        let query = supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("chatroom_id", chatroomId)
          .neq("user_id", profile.id); // Don't count own messages

        if (lastRead) {
          query = query.gt("created_at", lastRead);
        }

        const { count, error } = await query;

        if (!error && count) {
          totalUnread += count;
        }
      }

      setUnreadCount(totalUnread);

      // Update app badge (home screen icon)
      updateAppBadge(totalUnread);

      return totalUnread;
    } catch (error) {
      console.error("Error calculating unread:", error);
      return 0;
    }
  };

  // Update app badge (for mobile home screen icon)
  const updateAppBadge = (count: number) => {
    // For modern browsers with badge API
    if ("setAppBadge" in navigator) {
      if (count > 0) {
        (navigator as any).setAppBadge(count);
      } else {
        (navigator as any).clearAppBadge();
      }
    }

    // Update document title
    const originalTitle = document.title;
    if (count > 0) {
      document.title = `(${count}) ${originalTitle.replace(/^\(\d+\)\s/, "")}`;
    } else {
      document.title = originalTitle.replace(/^\(\d+\)\s/, "");
    }
  };

  // Mark a chatroom as read (call this when user enters a chatroom)
  const markChatroomAsRead = async (chatroomId: string) => {
    if (!profile?.id) return;

    const now = new Date().toISOString();

    // Update local state
    setLastReadTimestamps((prev) => {
      const updated = { ...prev, [chatroomId]: now };
      localStorage.setItem(
        `chat-last-read-${profile.id}`,
        JSON.stringify(updated),
      );
      return updated;
    });

    // Update database
    await supabase.from("user_chatroom_last_read").upsert(
      {
        user_id: profile.id,
        chatroom_id: chatroomId,
        last_read_at: now,
        updated_at: now,
      },
      {
        onConflict: "user_id,chatroom_id",
      },
    );

    // Recalculate total unread
    await calculateTotalUnread();
  };

  // Subscribe to new messages
  useEffect(() => {
    if (!supabase || !profile?.id) return;

    loadLastReadTimestamps();
    calculateTotalUnread();

    // Listen for new messages
    const channel = supabase
      .channel("unread-tracker")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `user_id=neq.${profile.id}`,
        },
        () => {
          // Recalculate when new message arrives
          calculateTotalUnread();
        },
      )
      .subscribe();

    // Recalculate every minute as fallback
    const interval = setInterval(() => {
      calculateTotalUnread();
    }, 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [profile?.id, supabase]);

  return {
    unreadCount,
    markChatroomAsRead,
    refreshUnreadCount: calculateTotalUnread,
  };
}
