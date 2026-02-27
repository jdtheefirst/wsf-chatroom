// components/chatrooms/BroadcastComposer.tsx

"use client";

import { useState } from "react";
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
} from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";
import { cn } from "@/lib/utils";
import { chatrooms } from "@/lib/constants";

interface BroadcastComposerProps {
  className?: string;
}

export function BroadcastComposer({ className }: BroadcastComposerProps) {
  const { profile, supabase } = useAuth();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  // Return rooms with uid; these are the ones we want to show in the broadcast composer
  const [selectedRooms, setSelectedRooms] = useState<string[]>(
    chatrooms.filter((r) => r.uid !== null).map((r) => r.uid),
  );
  const [file, setFile] = useState<File | null>(null);
  const [scheduleForLater, setScheduleForLater] = useState(false);
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const [priority, setPriority] = useState<
    "normal" | "urgent" | "announcement"
  >("normal");

  const isWSFUser = profile?.is_wsf;

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

  const toggleRoom = (roomId: string) => {
    setSelectedRooms((prev) =>
      prev.includes(roomId)
        ? prev.filter((id) => id !== roomId)
        : [...prev, roomId],
    );
  };

  const selectAllRooms = () => {
    setSelectedRooms(chatrooms.map((r) => r.id));
  };

  const clearAllRooms = () => {
    setSelectedRooms([]);
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

    setSending(true);

    try {
      let fileUrl: string | null = null;

      // Upload file if present
      if (file) {
        const fileName = `broadcast/${Date.now()}-${file.name.replace(
          /[^a-zA-Z0-9.-]/g,
          "_",
        )}`;

        const { error: uploadError } = await supabase.storage
          .from("chat-attachments")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        fileUrl = fileName;
      }

      for (const roomId of selectedRooms) {
        const { error } = await supabase.from("messages").insert({
          user_id: profile?.id,
          chatroom_id: roomId,
          content: content,
          language: "en", // Default to English for broadcasts
          file_url: fileUrl || null,
          translated_content: {},
        });

        if (error) {
          console.error(`Error inserting into room ${roomId}:`, error);
          throw new Error(`Failed to send to room ${roomId}`);
        }
      }

      toast.success(`Broadcast sent to all rooms!`);
      setContent("");
      setFile(null);
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

  const getPriorityColor = () => {
    switch (priority) {
      case "urgent":
        return "bg-red-500";
      case "announcement":
        return "bg-blue-500";
      default:
        return "bg-primary";
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="default"
          className={cn(
            "gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700",
            className,
          )}
        >
          <Megaphone className="h-4 w-4" />
          <span className="hidden sm:inline">WSF Broadcast</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
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
            Send an announcement to multiple chatrooms simultaneously. This
            message will appear as a broadcast in all selected rooms.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Priority Selection */}
          <div className="space-y-2">
            <Label>Priority Level</Label>
            <div className="flex gap-2">
              {(["normal", "announcement", "urgent"] as const).map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant={priority === p ? "default" : "outline"}
                  className={cn(
                    "flex-1 capitalize",
                    priority === p && {
                      "bg-primary": p === "normal",
                      "bg-blue-500 hover:bg-blue-600": p === "announcement",
                      "bg-red-500 hover:bg-red-600": p === "urgent",
                    },
                  )}
                  onClick={() => setPriority(p)}
                >
                  {p}
                </Button>
              ))}
            </div>
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
            <div className="grid grid-cols-2 gap-2">
              {chatrooms.map((room) => (
                <Button
                  key={room.id}
                  type="button"
                  variant={
                    selectedRooms.includes(room.id) ? "default" : "outline"
                  }
                  className={cn(
                    "justify-start gap-2",
                    selectedRooms.includes(room.id) && "bg-primary/90",
                  )}
                  onClick={() => toggleRoom(room.id)}
                  disabled={!room.uid}
                >
                  <Users className="h-4 w-4" />
                  <span className="truncate">{room.title}</span>
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
                <div className="flex items-center gap-2">
                  <File className="h-4 w-4" />
                  <div>
                    <p className="text-sm font-medium">{file.name}</p>
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
              <div className="flex items-center gap-2">
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
            <Label htmlFor="schedule">Schedule for later</Label>
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

          {/* Preview Section */}
          {content && (
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="p-4 rounded-lg border bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={cn("w-2 h-2 rounded-full", getPriorityColor())}
                  />
                  <span className="text-xs font-medium uppercase">
                    {priority}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    Broadcast to {selectedRooms.length} rooms
                  </Badge>
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
            className="gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send Broadcast
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
