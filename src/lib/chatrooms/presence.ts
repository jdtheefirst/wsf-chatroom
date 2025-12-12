// lib/chatrooms/presence.ts - Updated
"use client";

import { type SupabaseClient } from "@supabase/supabase-js";

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
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private isDestroyed = false;
  private retryCount = 0;
  private maxRetries = 3;

  constructor(private supabase: SupabaseClient, private chatroomId: string) {}

  async initialize(userId: string) {
    if (this.isDestroyed) {
      console.warn("Cannot initialize destroyed PresenceManager");
      return this;
    }

    if (this.isInitialized) {
      console.warn("PresenceManager already initialized");
      return this;
    }

    this.userId = userId;
    this.isInitialized = true;

    try {
      console.log("Initializing presence for user:", userId);

      // Set callback FIRST
      console.log("PresenceManager initialized, waiting for callback...");

      // Update database presence BEFORE setting up channel
      await this.updateDatabasePresence("online");

      // Load initial users
      await this.loadOnlineUsers();

      // Setup presence channel
      await this.setupPresenceChannel(userId);

      // Start heartbeat AFTER channel is ready
      this.startHeartbeat();

      this.retryCount = 0; // Reset retry counter on successful init
    } catch (error) {
      console.error("Failed to initialize presence:", error);
      await this.retryInitialization(userId);
    }

    return this;
  }

  private async retryInitialization(userId: string) {
    if (this.retryCount >= this.maxRetries) {
      console.error("Max retries reached for presence initialization");
      return;
    }

    this.retryCount++;
    console.log(
      `Retrying presence initialization (attempt ${this.retryCount})...`
    );

    await new Promise((resolve) => setTimeout(resolve, 1000 * this.retryCount));
    await this.cleanup();
    await this.initialize(userId);
  }

  private async setupPresenceChannel(userId: string) {
    if (this.channel) {
      console.warn("Channel already exists, cleaning up first");
      await this.cleanupChannel();
    }

    const userData = await this.getUserData(userId);
    if (!userData) {
      throw new Error("Failed to get user data");
    }

    this.channel = this.supabase.channel(`room:${this.chatroomId}`, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    return new Promise((resolve, reject) => {
      this.channel
        .on("presence", { event: "sync" }, () => {
          const state = this.channel.presenceState();
          this.handlePresenceSync(state);
        })
        .on("presence", { event: "join" }, ({ key, newPresences }: any) => {
          console.log("User joined presence:", key);
          this.handleUserJoin(key, newPresences[0]);
        })
        .on("presence", { event: "leave" }, ({ key }: any) => {
          console.log("User left presence:", key);
          this.handleUserLeave(key);
        })
        .subscribe(async (status: string) => {
          console.log(`Presence subscription status: ${status}`);

          if (status === "SUBSCRIBED") {
            try {
              await this.channel.track({
                user: userData,
                online_at: new Date().toISOString(),
              });
              resolve(status);
            } catch (error) {
              reject(error);
            }
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            reject(new Error(`Presence channel error: ${status}`));
          }
        });
    });
  }

  private async cleanupChannel() {
    if (this.channel) {
      try {
        await this.channel.unsubscribe();
        await this.supabase.removeChannel(this.channel);
      } catch (error) {
        console.error("Error cleaning up channel:", error);
      }
      this.channel = null;
    }
  }

  private async getUserData(userId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from("users_profile")
        .select("id, full_name, avatar_url, belt_level, country_code")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Error fetching user data:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error("Exception in getUserData:", error);
      return null;
    }
  }

  private async loadOnlineUsers() {
    try {
      const response = await fetch(
        `/api/chatrooms/presence/online?chatroomId=${this.chatroomId}`
      );

      if (!response.ok) {
        throw new Error(`Failed to load online users: ${response.status}`);
      }

      const { onlineUsers } = await response.json();

      this.users.clear();

      onlineUsers?.forEach((user: PresenceUser) => {
        this.users.set(user.id, user);
      });

      console.log("Loaded", this.users.size, "users from API");

      this.notifyChange();
    } catch (error) {
      console.error("Error loading online users:", error);
    }
  }

  private async updateDatabasePresence(status: "online" | "away" | "offline") {
    if (!this.userId) return;

    try {
      const response = await fetch("/api/chatrooms/presence/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: this.userId,
          chatroomId: this.chatroomId,
          status: status,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update presence: ${response.status}`);
      }
    } catch (error) {
      console.error("Error updating database presence:", error);
    }
  }

  private async updateUserDatabasePresence(
    userId: string,
    status: "online" | "away" | "offline"
  ) {
    try {
      const response = await fetch("/api/chatrooms/presence/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId,
          chatroomId: this.chatroomId,
          status: status,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update user presence: ${response.status}`);
      }
    } catch (error) {
      console.error(`Error updating presence for user ${userId}:`, error);
    }
  }

  private handlePresenceSync(presenceState: any) {
    const now = new Date().toISOString();
    const updatedUsers = new Set<string>();

    Object.values(presenceState).forEach((presences: any) => {
      presences.forEach((presence: any) => {
        const userId = presence.key;
        const userData = presence.user;

        if (userId && userData) {
          this.users.set(userId, {
            id: userId,
            full_name: userData.full_name,
            avatar_url: userData.avatar_url,
            belt_level: userData.belt_level || 0,
            country_code: userData.country_code || "unknown",
            last_seen: now,
            status: "online",
          });
          updatedUsers.add(userId);
        }
      });
    });

    // Mark users not in presence state as offline
    Array.from(this.users.keys()).forEach((userId) => {
      if (!updatedUsers.has(userId)) {
        const user = this.users.get(userId);
        if (user && user.status === "online") {
          this.users.set(userId, {
            ...user,
            status: "offline",
            last_seen: now,
          });
        }
      }
    });

    this.notifyChange();
  }

  private leaveTimeouts = new Map<string, NodeJS.Timeout>();

  private async handleUserJoin(userId: string, presenceData: any) {
    console.log("User joined:", userId);

    // Clear any pending leave timeout
    if (this.leaveTimeouts.has(userId)) {
      clearTimeout(this.leaveTimeouts.get(userId));
      this.leaveTimeouts.delete(userId);
    }

    if (presenceData?.user) {
      this.users.set(userId, {
        id: userId,
        full_name: presenceData.user.full_name,
        avatar_url: presenceData.user.avatar_url,
        belt_level: presenceData.user.belt_level || 0,
        country_code: presenceData.user.country_code || "unknown",
        last_seen: new Date().toISOString(),
        status: "online",
      });

      await this.updateUserDatabasePresence(userId, "online");
      this.notifyChange();
    }
  }

  private async handleUserLeave(userId: string) {
    console.log("User left event received:", userId);

    console.log("User left event received:", userId);

    const user = this.users.get(userId);
    console.log("Current user state before leave:", user);

    // Debounce the leave event
    if (this.leaveTimeouts.has(userId)) {
      clearTimeout(this.leaveTimeouts.get(userId));
    }

    const timeout = setTimeout(async () => {
      const user = this.users.get(userId);
      if (user) {
        console.log("Actually marking user as away:", userId);
        this.users.set(userId, {
          ...user,
          status: "away",
          last_seen: new Date().toISOString(),
        });

        await this.updateUserDatabasePresence(userId, "away");
        this.notifyChange();

        // Schedule offline status after longer period
        setTimeout(() => {
          const currentUser = this.users.get(userId);
          if (currentUser && currentUser.status === "away") {
            this.users.set(userId, {
              ...currentUser,
              status: "offline",
            });
            this.notifyChange();
          }
        }, 60000); // 1 minute
      }
      this.leaveTimeouts.delete(userId);
    }, 2000); // Wait 2 seconds before marking as away

    this.leaveTimeouts.set(userId, timeout);
  }

  private startHeartbeat() {
    // Update presence every 20 seconds
    this.heartbeatInterval = setInterval(async () => {
      if (this.channel && this.userId) {
        const userData = await this.getUserData(this.userId);
        if (userData) {
          await this.channel.track({
            user: userData,
            online_at: new Date().toISOString(),
          });

          // Also update database presence via API
          await this.updateDatabasePresence("online");
        }
      }
    }, 20000);
  }

  // In presence.ts - Update the notifyChange method
  private notifyChange() {
    console.log("notifyChange called, has callback?", !!this.onChangeCallback);
    console.log(
      "Current users:",
      Array.from(this.users.values()).map((u) => ({
        id: u.id,
        name: u.full_name,
        status: u.status,
      }))
    );

    if (this.onChangeCallback) {
      const usersArray = Array.from(this.users.values());
      console.log("Calling onChangeCallback with", usersArray.length, "users");
      this.onChangeCallback(usersArray);
    }
  }

  // private notifyChange() {
  //   if (this.onChangeCallback) {
  //     const usersArray = Array.from(this.users.values());
  //     this.onChangeCallback(usersArray);
  //   }
  // }

  // Public API
  onUsersChange(callback: (users: PresenceUser[]) => void) {
    this.onChangeCallback = callback;
  }

  async setUserStatus(status: "online" | "away") {
    if (!this.userId || !this.channel) return;

    try {
      const userData = await this.getUserData(this.userId);
      if (userData) {
        await this.channel.track({
          user: userData,
          online_at: new Date().toISOString(),
          status: status,
        });

        await this.updateDatabasePresence(status);
      }
    } catch (error) {
      console.error("Error setting user status:", error);
    }
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

  getAllUsers(): PresenceUser[] {
    return Array.from(this.users.values());
  }

  private async cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    await this.cleanupChannel();

    this.users.clear();
    this.userId = null;
    this.isInitialized = false;
  }

  async destroy() {
    if (this.isDestroyed) return;

    this.isDestroyed = true;
    this.isInitialized = false;

    // Mark as offline via API
    if (this.userId) {
      try {
        await this.updateDatabasePresence("offline");
      } catch (error) {
        console.error("Error updating presence to offline:", error);
      }
    }

    // Clean up heartbeat interval
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Clean up channel
    await this.cleanupChannel();

    // Clear internal state
    this.users.clear();
    this.onChangeCallback = null;
    this.userId = null;
  }
}
