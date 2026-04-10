// components/chatrooms/BroadcastComposer.tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Send,
  Loader2,
  Megaphone,
  X,
  File,
  Paperclip,
  Shield,
  Users,
  AlertTriangle,
  Bell,
  Clock,
  CheckCircle2,
  Globe,
  Mail,
} from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";
import { cn } from "@/lib/utils";
import { chatrooms } from "@/lib/constants";

interface BroadcastComposerProps {
  className?: string;
  onBroadcastSent?: () => void;
}

// Priority configuration
const PRIORITY_CONFIG = {
  normal: {
    label: "Normal",
    description: "Regular broadcast with push notifications",
    color: "bg-primary",
    icon: Megaphone,
    badgeClass: "badge-normal",
  },
  announcement: {
    label: "Announcement",
    description: "High priority with email + push notifications",
    color: "bg-blue-500",
    icon: Bell,
    badgeClass: "badge-announcement",
  },
  urgent: {
    label: "Urgent",
    description: "Critical - immediate email + push notifications",
    color: "bg-red-500",
    icon: AlertTriangle,
    badgeClass: "badge-urgent",
  },
};

export function BroadcastComposer({
  className,
  onBroadcastSent,
}: BroadcastComposerProps) {
  const { profile, supabase } = useAuth();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedRooms, setSelectedRooms] = useState<string[]>(
    chatrooms.filter((r) => r.uid !== null).map((r) => r.uid as string),
  );
  const [file, setFile] = useState<File | null>(null);
  const [scheduleForLater, setScheduleForLater] = useState(false);
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const [priority, setPriority] = useState<
    "normal" | "urgent" | "announcement"
  >("normal");
  const [rateLimitRemaining, setRateLimitRemaining] = useState<number | null>(
    null,
  );
  const [broadcastStats, setBroadcastStats] = useState<{
    totalMembers?: number;
    pushSent?: number;
    emailsSent?: number;
  } | null>(null);

  // Get database chatrooms
  useEffect(() => {
    const fetchChatrooms = async () => {
      const { data, error } = await supabase.from("chatrooms").select("*");
      if (error) {
        console.error("Error fetching chatrooms:", error);
        return;
      }
      if (data && data.length > 0) {
        setSelectedRooms(
          data.filter((r) => r.id !== null).map((r) => r.id as string),
        );
      }
    };
    fetchChatrooms();
  }, [supabase]);

  const isWSFUser = profile?.is_wsf;
  const committeeRoom = chatrooms.find((r) => r.id === "wsf_committee");

  const toggleRoom = (roomUid: string | null) => {
    if (!roomUid) return;
    setSelectedRooms((prev) =>
      prev.includes(roomUid)
        ? prev.filter((id) => id !== roomUid)
        : [...prev, roomUid],
    );
  };

  const selectAllRooms = () => {
    setSelectedRooms(
      chatrooms.filter((r) => r.uid !== null).map((r) => r.uid as string),
    );
  };

  const clearAllRooms = () => {
    setSelectedRooms([]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    const fileSizeMB = selectedFile.size / (1024 * 1024);
    if (fileSizeMB > 10) {
      toast.error("File size must be less than 10MB");
      return;
    }
    setFile(selectedFile);
  };

  // Check rate limit before sending
  const checkRateLimit = async (): Promise<boolean> => {
    try {
      const response = await fetch("/api/broadcast/rate-limit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      setRateLimitRemaining(data.remaining);
      if (!data.allowed) {
        toast.error(
          `Rate limit exceeded. You can send ${data.remaining || 0} more broadcasts today.`,
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error("Rate limit check failed:", error);
      return true; // Allow on error
    }
  };

  const handleSendBroadcast = async () => {
    if (!profile?.id) {
      toast.error("You must be logged in to broadcast");
      return;
    }

    if (!content.trim() && !file) {
      toast.error("Please enter a message or attach a file");
      return;
    }

    if (selectedRooms.length === 0) {
      toast.error("Please select at least one room to broadcast to");
      return;
    }

    // Check rate limit for non-WSF users or based on priority
    if (priority === "urgent" || priority === "announcement") {
      const allowed = await checkRateLimit();
      if (!allowed) return;
    }

    setSending(true);
    setBroadcastStats(null);

    try {
      let fileUrl: string | null = null;

      // Upload file if present
      if (file) {
        const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const filePath = `${committeeRoom?.uid || "broadcast"}/${profile.id}/${Date.now()}_${safeFileName}`;

        const { error: uploadError } = await supabase.storage
          .from("chat-attachments")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;
        fileUrl = filePath;
      }

      const broadcastResults = [];

      // Send to each selected room
      for (const roomId of selectedRooms) {
        // Insert broadcast message
        const { data: message, error: insertError } = await supabase
          .from("messages")
          .insert({
            user_id: profile.id,
            chatroom_id: roomId,
            content: content.trim() || (file ? "(File attached)" : ""),
            language: profile.language || "en",
            file_url: fileUrl,
            translated_content: {},
            is_broadcast: true,
            priority: priority,
            scheduled_at:
              scheduleForLater && scheduledTime
                ? new Date(scheduledTime)
                : null,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // If not scheduled, trigger notifications immediately
        if (!scheduleForLater) {
          const notificationResponse = await fetch(
            "/api/pwa/send-notification",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                message: {
                  id: message.id,
                  content: content.trim(),
                  user_id: profile.id,
                  user_name: profile.full_name,
                  user_avatar: profile.avatar_url,
                },
                chatroomId: roomId,
                priority: priority,
              }),
            },
          );

          const result = await notificationResponse.json();
          broadcastResults.push({
            roomId,
            stats: result.stats,
          });

          if (result.stats) {
            setBroadcastStats(result.stats);
          }
        }

        // Small delay between rooms to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Show success message with stats
      const totalMembers = broadcastResults.reduce(
        (sum, r) => sum + (r.stats?.totalMembers || 0),
        0,
      );
      const totalPush = broadcastResults.reduce(
        (sum, r) => sum + (r.stats?.pushSent || 0),
        0,
      );
      const totalEmails = broadcastResults.reduce(
        (sum, r) => sum + (r.stats?.emailsSent || 0),
        0,
      );

      if (scheduleForLater) {
        toast.success(
          `Broadcast scheduled for ${new Date(scheduledTime).toLocaleString()}`,
        );
      } else {
        toast.success(`Broadcast sent to ${selectedRooms.length} room(s)!`, {
          description:
            priority !== "normal"
              ? `📨 ${totalPush} push notifications • ✉️ ${totalEmails} emails sent`
              : `📨 ${totalPush} push notifications sent`,
          duration: 5000,
        });
      }

      // Reset form
      setContent("");
      setFile(null);
      setScheduleForLater(false);
      setScheduledTime("");
      setPriority("normal");

      if (onBroadcastSent) {
        onBroadcastSent();
      }

      setOpen(false);
    } catch (error: any) {
      console.error("Broadcast error:", error);
      toast.error(error.message || "Failed to send broadcast");
    } finally {
      setSending(false);
    }
  };

  if (!isWSFUser) {
    return null;
  }

  const priorityConfig = PRIORITY_CONFIG[priority];
  const PriorityIcon = priorityConfig.icon;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size={"icon"}
          className={cn("border-none shadow-none", className)}
        >
          <Megaphone className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Megaphone className="h-5 w-5 text-purple-500" />
            Send WSF Broadcast
            <Badge variant="outline" className="ml-2">
              <Shield className="h-3 w-3 mr-1" />
              Admin Only
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Send an announcement to multiple chatrooms simultaneously.
            {priority !== "normal" && (
              <span className="block mt-1 text-amber-600 dark:text-amber-400">
                ⚠️{" "}
                {priority === "urgent"
                  ? "Urgent broadcasts send push notifications AND emails to all members immediately."
                  : "Announcements send high-priority notifications to all members."}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Priority Selection */}
          <div className="space-y-2">
            <Label>Priority Level</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["normal", "announcement", "urgent"] as const).map((p) => {
                const config = PRIORITY_CONFIG[p];
                const Icon = config.icon;
                return (
                  <Button
                    key={p}
                    type="button"
                    variant={priority === p ? "default" : "outline"}
                    className={cn(
                      "flex flex-col gap-1 h-auto py-3",
                      priority === p && {
                        "bg-primary": p === "normal",
                        "bg-blue-500 hover:bg-blue-600": p === "announcement",
                        "bg-red-500 hover:bg-red-600": p === "urgent",
                      },
                    )}
                    onClick={() => setPriority(p)}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs capitalize">{config.label}</span>
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {priorityConfig.description}
            </p>
          </div>

          {/* Room Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Target Rooms ({selectedRooms.length} selected)</Label>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAllRooms}
                  className="h-7 text-xs"
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllRooms}
                  className="h-7 text-xs"
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto p-1">
              {chatrooms.map((room) => (
                <Button
                  key={room.id}
                  type="button"
                  variant={
                    room.uid && selectedRooms.includes(room.uid)
                      ? "default"
                      : "outline"
                  }
                  className="justify-start gap-2"
                  onClick={() => toggleRoom(room.uid)}
                  disabled={!room.uid}
                >
                  <Globe className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate text-sm">{room.title}</span>
                  {!room.uid && (
                    <Badge variant="outline" className="ml-auto text-xs">
                      No UID
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          </div>

          {/* Message Input */}
          <div className="space-y-2">
            <Label>Broadcast Message</Label>
            <div className="relative">
              <Textarea
                placeholder="Type your broadcast message here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[120px] resize-none pr-12"
                maxLength={2000}
              />
              <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                {content.length}/2000
              </div>
            </div>
          </div>

          {/* File Attachment */}
          <div className="space-y-2">
            <Label>Attachment (Optional)</Label>
            {file ? (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2 min-w-0">
                  <File className="h-4 w-4 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFile(null)}
                  className="h-7 w-7"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="file"
                  id="broadcast-file"
                  className="hidden"
                  onChange={handleFileSelect}
                  accept="image/*,.pdf,.doc,.docx,.txt"
                />
                <Button
                  variant="outline"
                  onClick={() =>
                    document.getElementById("broadcast-file")?.click()
                  }
                  className="gap-2"
                >
                  <Paperclip className="h-4 w-4" />
                  Attach File
                </Button>
                <span className="text-xs text-muted-foreground">
                  Max 10MB. Images, PDFs, documents
                </span>
              </div>
            )}
          </div>

          {/* Schedule Option */}
          <div className="flex items-center space-x-2">
            <Switch
              id="schedule"
              checked={scheduleForLater}
              onCheckedChange={setScheduleForLater}
            />
            <Label htmlFor="schedule" className="flex items-center gap-2">
              <Clock className="h-3 w-3" />
              Schedule for later
            </Label>
          </div>

          {scheduleForLater && (
            <div className="pl-6">
              <input
                type="datetime-local"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>
          )}

          {/* Rate Limit Info */}
          {rateLimitRemaining !== null && priority !== "normal" && (
            <div className="text-xs text-muted-foreground text-center">
              Remaining {priority} broadcasts today: {rateLimitRemaining}
            </div>
          )}

          {/* Preview Section */}
          {content && (
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="p-4 rounded-lg border bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <div
                    className={cn("w-2 h-2 rounded-full", priorityConfig.color)}
                  />
                  <span className="text-xs font-medium uppercase">
                    {priorityConfig.label}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    Broadcast to {selectedRooms.length} room
                    {selectedRooms.length !== 1 ? "s" : ""}
                  </Badge>
                  {priority !== "normal" && (
                    <Badge variant="secondary" className="text-xs">
                      <Mail className="h-3 w-3 mr-1" />
                      Email included
                    </Badge>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap">{content}</p>
                {file && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <File className="h-3 w-3" />
                    <span>Attachment: {file.name}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Broadcast Stats (after sending) */}
          {broadcastStats && broadcastStats.totalMembers && (
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                  Broadcast Complete
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div>
                  <div className="font-bold text-green-700 dark:text-green-400">
                    {broadcastStats.totalMembers}
                  </div>
                  <div className="text-xs text-muted-foreground">Members</div>
                </div>
                <div>
                  <div className="font-bold text-green-700 dark:text-green-400">
                    {broadcastStats.pushSent || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Push Sent</div>
                </div>
                <div>
                  <div className="font-bold text-green-700 dark:text-green-400">
                    {broadcastStats.emailsSent || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Emails Sent
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSendBroadcast}
            disabled={
              sending ||
              (!content.trim() && !file) ||
              selectedRooms.length === 0
            }
            className={cn(
              "gap-2",
              priority === "urgent"
                ? "bg-red-500 hover:bg-red-600"
                : priority === "announcement"
                  ? "bg-blue-500 hover:bg-blue-600"
                  : "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700",
            )}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {scheduleForLater ? "Scheduling..." : "Sending Broadcast..."}
              </>
            ) : (
              <>
                {scheduleForLater ? (
                  <Clock className="h-4 w-4" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {scheduleForLater ? "Schedule Broadcast" : "Send Broadcast"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
