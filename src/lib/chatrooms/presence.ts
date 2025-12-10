// lib/chatrooms/presence.ts
import { SupabaseClient } from "@supabase/supabase-js";

export type PresenceUser = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  belt_level: number;
  country_code: string;
  last_seen: string;
  status: "online" | "away" | "offline";
};

export class PresenceManager {
  private channel: any = null;
  private users = new Map<string, PresenceUser>();
  private onChangeCallback: ((users: PresenceUser[]) => void) | null = null;
  private userId: string | null = null;
  private timeoutId: NodeJS.Timeout | null = null;

  constructor(
    private supabase: SupabaseClient,
    private chatroomId: string
  ) {}

  async initialize(userId: string) {
    this.userId = userId;
    
    // Clean up previous channel
    if (this.channel) {
      await this.supabase.removeChannel(this.channel);
    }

    // Get initial online users
    await this.fetchInitialUsers();

    // Set up presence channel
    this.channel = this.supabase.channel(`presence:${this.chatroomId}`, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    // Track presence state changes
    this.channel
      .on("presence", { event: "sync" }, () => {
        const state = this.channel.presenceState();
        this.updateUsersFromPresence(state);
      })
      .on("presence", { event: "join" }, ({ key, newPresences }: any) => {
        console.log("User joined:", key);
        this.handleUserJoin(newPresences[0]);
      })
      .on("presence", { event: "leave" }, ({ key }: any) => {
        console.log("User left:", key);
        this.handleUserLeave(key);
      })
      .subscribe(async (status: string) => {
        if (status === "SUBSCRIBED") {
          // Track this user as present
          const userData = await this.getUserData(userId);
          if (userData) {
            await this.channel.track({
              ...userData,
              last_seen: new Date().toISOString(),
              status: "online",
            });
          }
        }
      });

    // Set up heartbeat to keep presence alive
    this.startHeartbeat();
  }

  private async fetchInitialUsers() {
    try {
      // Fetch users who were recently active (last 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { data: activeUsers, error } = await this.supabase
        .from("users_profile")
        .select("id, full_name, avatar_url, belt_level, country_code")
        .in("id", this.getRecentlyActiveUserIds())
        .order("full_name");

      if (error) throw error;

      activeUsers?.forEach((user: any) => {
        this.users.set(user.id, {
          ...user,
          last_seen: new Date().toISOString(),
          status: "online",
        });
      });

      this.notifyChange();
    } catch (error) {
      console.error("Error fetching initial users:", error);
    }
  }

  private getRecentlyActiveUserIds(): string[] {
    // This would query your messages table for recent activity
    // For now, return empty array - implement based on your schema
    return [];
  }

  private async getUserData(userId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from("users_profile")
        .select("id, full_name, avatar_url, belt_level, country_code")
        .eq("id", userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error fetching user data:", error);
      return null;
    }
  }

  private handleUserJoin(presenceData: any) {
    const userId = presenceData?.id || presenceData?.user_id;
    if (!userId) return;

    this.users.set(userId, {
      id: userId,
      full_name: presenceData.full_name,
      avatar_url: presenceData.avatar_url,
      belt_level: presenceData.belt_level || 0,
      country_code: presenceData.country_code || "unknown",
      last_seen: new Date().toISOString(),
      status: "online",
    });

    this.notifyChange();
  }

  private handleUserLeave(userId: string) {
    const user = this.users.get(userId);
    if (user) {
      this.users.set(userId, {
        ...user,
        status: "offline",
        last_seen: new Date().toISOString(),
      });

      // Remove after 1 minute of being offline
      setTimeout(() => {
        if (this.users.get(userId)?.status === "offline") {
          this.users.delete(userId);
          this.notifyChange();
        }
      }, 60000);

      this.notifyChange();
    }
  }

  private updateUsersFromPresence(presenceState: any) {
    const now = new Date().toISOString();
    
    Object.values(presenceState).forEach((presences: any) => {
      presences.forEach((presence: any) => {
        const userId = presence?.id || presence?.user_id;
        if (userId) {
          this.users.set(userId, {
            id: userId,
            full_name: presence.full_name,
            avatar_url: presence.avatar_url,
            belt_level: presence.belt_level || 0,
            country_code: presence.country_code || "unknown",
            last_seen: now,
            status: "online",
          });
        }
      });
    });

    this.notifyChange();
  }

  private startHeartbeat() {
    // Send heartbeat every 30 seconds
    this.timeoutId = setInterval(async () => {
      if (this.channel && this.userId) {
        const userData = await this.getUserData(this.userId);
        if (userData) {
          await this.channel.track({
            ...userData,
            last_seen: new Date().toISOString(),
            status: "online",
          });
        }
      }
    }, 30000);
  }

  private notifyChange() {
    if (this.onChangeCallback) {
      const usersArray = Array.from(this.users.values());
      this.onChangeCallback(usersArray);
    }
  }

  onUsersChange(callback: (users: PresenceUser[]) => void) {
    this.onChangeCallback = callback;
  }

  async setUserStatus(status: "online" | "away") {
    if (!this.userId || !this.channel) return;

    const userData = await this.getUserData(this.userId);
    if (userData) {
      await this.channel.track({
        ...userData,
        last_seen: new Date().toISOString(),
        status,
      });
    }
  }

  async destroy() {
    // Clean up
    if (this.timeoutId) {
      clearInterval(this.timeoutId);
    }

    if (this.channel) {
      // Untrack user before leaving
      await this.channel.untrack();
      await this.supabase.removeChannel(this.channel);
    }

    this.users.clear();
    this.onChangeCallback = null;
  }

  getOnlineCount(): number {
    return Array.from(this.users.values()).filter(
      (user) => user.status === "online"
    ).length;
  }

  getOnlineUsers(): PresenceUser[] {
    return Array.from(this.users.values()).filter(
      (user) => user.status === "online"
    );
  }
}