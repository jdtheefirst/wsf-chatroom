// components/chatrooms/ChatroomMessagesEnhanced.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/lib/context/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Send,
  File,
  Paperclip,
  Edit2,
  Trash2,
  Globe,
  MoreVertical,
  Smile,
  Users,
  Share2,
  Copy,
  Check,
  MessageSquare,
  Clock,
} from "lucide-react";
import { deleteMessage, updateMessage } from "@/lib/chatrooms/messages";
import { supportedLanguages, LanguageCode } from "@/lib/chatrooms/languages";
import { translateText } from "@/lib/chatrooms/translation";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { getBeltColor } from "@/lib/constants";
import { Select, SelectContent, SelectItem } from "../ui/select";
import { PresenceManager, PresenceUser } from "@/lib/chatrooms/presence";
import { EmojiPickerComponent } from "./EmojiPicker";

type MessageRow = {
  user_id: string;
  id: string;
  content: string;
  language: string | null;
  translated_content?: Record<string, string> | null;
  file_url: string | null;
  created_at: string;
  user: {
    id: string;
    full_name: string | null;
    email?: string | null;
    avatar_url: string | null;
    belt_level?: number;
    role?: string;
  } | null;
};

type Props = {
  chatroomId: string;
  allowFiles: boolean;
  shareable: boolean;
  initialMessages: MessageRow[];
};

export function ChatroomMessagesEnhanced({
  chatroomId,
  allowFiles,
  shareable,
  initialMessages,
}: Props) {
  const { profile, supabase } = useAuth();
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [targetLang, setTargetLang] = useState<LanguageCode>(
    (supportedLanguages.some(lang => lang.code === profile?.language) ? profile?.language : "en") as LanguageCode
  );
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "info" | "members">("chat");
  const [onlineCount, setOnlineCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const presenceManagerRef = useRef<PresenceManager | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Realtime subscription for messages
  useEffect(() => {
    const channel = supabase
      .channel(`chatroom:${chatroomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chatroom_id=eq.${chatroomId}`,
        },
        async (payload) => {
          const newMessage = payload.new as MessageRow;
          
          // Fetch user profile for the new message
          const { data: userProfile } = await supabase
            .from("users_profile")
            .select("id, full_name, avatar_url, email, belt_level, role")
            .eq("id", newMessage.user_id)
            .maybeSingle();

          const messageWithUser: MessageRow = {
            ...newMessage,
            user: userProfile || null,
          };

          setMessages((prev) => [...prev, messageWithUser]);
          toast.success("New message received!");
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `chatroom_id=eq.${chatroomId}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === payload.new.id ? { ...msg, ...payload.new } : msg
            )
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `chatroom_id=eq.${chatroomId}`,
        },
        (payload) => {
          setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id));
        }
      )
      .subscribe((status) => {
        console.log("Subscription status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatroomId, supabase]);



  // Initialize presence tracking
  useEffect(() => {
    if (!profile?.id || !supabase) return;

    presenceManagerRef.current = new PresenceManager(supabase, chatroomId);
    
    presenceManagerRef.current.onUsersChange((users) => {
      setOnlineUsers(users);
      setOnlineCount(users.filter(u => u.status === "online").length);
    });

    presenceManagerRef.current.initialize(profile.id);

    // Set user as away when window loses focus
    const handleVisibilityChange = () => {
      if (presenceManagerRef.current) {
        if (document.hidden) {
          presenceManagerRef.current.setUserStatus("away");
        } else {
          presenceManagerRef.current.setUserStatus("online");
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (presenceManagerRef.current) {
        presenceManagerRef.current.destroy();
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [profile?.id, supabase, chatroomId]);

  // Handle emoji insertion
  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = input.substring(0, start) + emoji + input.substring(end);
    
    setInput(newText);
    
    // Focus back and set cursor after emoji
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  const sendMessage = async () => {
    if (!profile) {
      toast.error("Please sign in to send messages.");
      return;
    }
    
    if (!input.trim() && !file) {
      toast.error("Please enter a message or attach a file.");
      return;
    }

    setSending(true);
    setIsUploading(true);
    const text = input.trim();
    const currentFile = file;
    
    setInput("");
    setFile(null);
    
    try {
      let fileUrl: string | null = null;
      
      // Handle file upload
      if (currentFile && allowFiles) {
        const fileSizeMB = currentFile.size / (1024 * 1024);
        if (fileSizeMB > 10) { // 10MB limit
          throw new Error("File size exceeds 10MB limit");
        }

        const fileName = `${Date.now()}-${currentFile.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
        const filePath = `chatrooms/${chatroomId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("chat_uploads")
          .upload(filePath, currentFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("chat_uploads")
          .getPublicUrl(filePath);

        fileUrl = filePath;
        setFileUrls((prev) => ({ ...prev, [filePath]: publicUrl }));
      }

      // Insert message
      const { error: insertError } = await supabase
        .from("messages")
        .insert({
          chatroom_id: chatroomId,
          content: text || "(File attached)",
          language: profile?.language || "en",
          file_url: fileUrl,
          translated_content: {},
        });

      if (insertError) throw insertError;

      toast.success("Message sent!");
      
    } catch (err: any) {
      console.error("Send message error:", err);
      toast.error(err.message || "Failed to send message");
      setInput(text); // Restore text if error
    } finally {
      setSending(false);
      setIsUploading(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!allowFiles) {
      toast.error("File uploads are disabled in this chatroom.");
      return;
    }

    const fileSizeMB = selectedFile.size / (1024 * 1024);
    if (fileSizeMB > 10) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setFile(selectedFile);
    toast.success(`File selected: ${selectedFile.name}`);
  };

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const copyMessage = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      toast.success("Message copied to clipboard!");
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      toast.error("Failed to copy message");
    }
  };

  const shareMessage = async (messageId: string) => {
    if (!shareable) {
      toast.error("This chatroom is not shareable");
      return;
    }

    const message = messages.find((m) => m.id === messageId);
    if (!message) return;

    const shareUrl = `${window.location.origin}/share/message/${messageId}`;
    const shareText = `${message.user?.full_name || "User"}: ${message.content}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "WSF Chatroom Message",
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        console.error("Share failed:", err);
      }
    } else {
      await copyMessage(shareUrl, messageId);
    }
  };

  const startEdit = (messageId: string, content: string) => {
    setEditingId(messageId);
    setEditText(content);
  };

  const saveEdit = async () => {
    if (!editingId || !editText.trim()) {
      setEditingId(null);
      setEditText("");
      return;
    }

    try {
      const { error } = await updateMessage(supabase, editingId, editText);
      if (error) throw error;
      toast.success("Message updated");
      setEditingId(null);
      setEditText("");
    } catch (err) {
      toast.error("Failed to update message");
    }
  };

  const removeMessage = async (messageId: string) => {
    if (!confirm("Are you sure you want to delete this message?")) return;

    try {
      const { error } = await deleteMessage(supabase, messageId);
      if (error) throw error;
      toast.success("Message deleted");
    } catch (err) {
      toast.error("Failed to delete message");
    }
  };

  const translateMessage = async (message: MessageRow) => {
    if (!message.content || targetLang === message.language) return;

    if (message.translated_content?.[targetLang]) {
      toast.info("Already translated to selected language");
      return;
    }

    try {
      toast.loading("Translating...");
      const translated = await translateText(message.content, targetLang);
      
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === message.id
            ? {
                ...msg,
                translated_content: {
                  ...(msg.translated_content || {}),
                  [targetLang]: translated,
                },
              }
            : msg
        )
      );
      
      toast.dismiss();
      toast.success("Translation complete!");
    } catch (err) {
      toast.dismiss();
      toast.error("Translation failed");
    }
  };

  const renderMessageContent = (message: MessageRow) => {
    const translated = message.translated_content?.[targetLang];
    const showTranslated = translated && targetLang !== message.language;

    return (
      <div className="space-y-2">
        <p className="text-sm whitespace-pre-wrap break-words">
          {showTranslated ? translated : message.content}
        </p>
        {showTranslated && (
          <div className="text-xs text-muted-foreground border-l-2 border-primary pl-2">
            <span className="font-medium">Original ({message.language}):</span>{" "}
            {message.content}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <h2 className="text-xl font-semibold">WSF Fans Chatroom</h2>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm text-muted-foreground">
  <div className="flex items-center gap-1.5">
    <Globe className="h-3.5 w-3.5 shrink-0" />
    <span className="whitespace-nowrap">Public • Shareable</span>
  </div>

  <Separator 
    orientation="vertical" 
    className="hidden sm:flex h-4" 
  />

  <Badge 
    variant="outline" 
    className="flex items-center gap-1.5 whitespace-nowrap"
  >
    <Users className="h-3.5 w-3.5 shrink-0" />
    {onlineCount} online
  </Badge>
</div>

          </div>
        </div>
        
        <div className="flex items-center flex-col sm:flex-row gap-2">
          <Select
            value={targetLang}
            onValueChange={(value) => setTargetLang(value as LanguageCode)}
          >
            <SelectContent>
              {supportedLanguages.map((lang) => (
              <SelectItem key={lang.code} value={lang.code}>
                {lang.label}
              </SelectItem>
            ))}</SelectContent>
            
          </Select>
          
          {shareable && (
            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              Share Room
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v as any)} className="flex-1">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="flex-1 overflow-hidden mt-0">
          {/* Messages Container */}
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <MessageSquare className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Welcome to the WSF Fans Chatroom!</h3>
                  <p className="text-muted-foreground max-w-md">
                    This is a public chatroom for all WSF members and fans. Share your Samma journey, ask questions, and connect with the global community.
                  </p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors",
                      message.user_id === profile?.id && "bg-primary/5"
                    )}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={message.user?.avatar_url || ""} />
                      <AvatarFallback className="text-xs">
                        {getInitials(message.user?.full_name ?? null)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {message.user?.full_name || "Anonymous User"}
                          </span>
                          {message.user?.belt_level !== undefined && (
                            <Badge variant="outline" className={cn("text-xs", getBeltColor(message.user.belt_level))}>
                              Belt {message.user.belt_level}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                          </span>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => copyMessage(message.content, message.id)}>
                              {copiedMessageId === message.id ? (
                                <Check className="h-4 w-4 mr-2" />
                              ) : (
                                <Copy className="h-4 w-4 mr-2" />
                              )}
                              Copy Text
                            </DropdownMenuItem>
                            {shareable && (
                              <DropdownMenuItem onClick={() => shareMessage(message.id)}>
                                <Share2 className="h-4 w-4 mr-2" />
                                Share Message
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => translateMessage(message)}>
                              <Globe className="h-4 w-4 mr-2" />
                              Translate
                            </DropdownMenuItem>
                            {message.user_id === profile?.id && (
                              <>
                                <DropdownMenuItem onClick={() => startEdit(message.id, message.content)}>
                                  <Edit2 className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => removeMessage(message.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {editingId === message.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            autoFocus
                            className="min-h-[80px]"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={saveEdit}>
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingId(null);
                                setEditText("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        renderMessageContent(message)
                      )}

                      {message.file_url && fileUrls[message.file_url] && (
                        <div className="mt-2">
                          <a
                            href={fileUrls[message.file_url]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm hover:bg-muted/80 transition-colors"
                          >
                            <File className="h-4 w-4" />
                            {message.file_url.split("/").pop()}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="border-t p-2 sm:p-4">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Textarea
                    ref={textareaRef}
                    placeholder="Type your message here... (Press Enter to send, Shift+Enter for new line)"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyPress}
                    disabled={sending}
                    className="min-h-[60px] resize-none"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      {/* Emoji Picker */}
              <EmojiPickerComponent
                onEmojiSelect={handleEmojiSelect}
                disabled={sending}
              />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!allowFiles || sending}
                        title="Attach file"
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileSelect}
                        className="hidden"
                        disabled={!allowFiles || sending}
                      />
                      
                      {file && (
                        <Badge variant="secondary" className="gap-1">
                          <File className="h-3 w-3" />
                          {file.name}
                          <button
                            onClick={() => setFile(null)}
                            className="ml-1 hover:text-destructive"
                          >
                            ×
                          </button>
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {isUploading && (
                        <span className="text-xs text-muted-foreground">Uploading...</span>
                      )}
                      <Button
                        onClick={sendMessage}
                        disabled={(!input.trim() && !file) || sending}
                        className="gap-2"
                      >
                        {sending ? "Sending..." : "Send"}
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="info" className="mt-0 p-2 sm:p-4">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Chatroom Information</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 rounded-lg border p-4">
                <h4 className="font-medium">Features</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Public and shareable messages</li>
                  <li>• Auto-translation to multiple languages</li>
                  <li>• File attachments (up to 10MB)</li>
                  <li>• Real-time messaging</li>
                  <li>• Message editing and deletion</li>
                </ul>
              </div>
              <div className="space-y-2 rounded-lg border p-4">
                <h4 className="font-medium">Rules</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Be respectful to all members</li>
                  <li>• No spam or advertising</li>
                  <li>• Keep conversations Samma-related</li>
                  <li>• No inappropriate content</li>
                  <li>• Follow WSF Code of Conduct</li>
                </ul>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Online Users Tab - Updated */}
    <TabsContent value="members" className="mt-0 p-2 sm:p-4 h-full overflow-y-auto">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Online Members</h3>
          <Badge variant="outline" className="gap-1">
            <Users className="h-3 w-3" />
            {onlineCount} online
          </Badge>
        </div>
        
        <div className="space-y-2">
          {onlineUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No members online right now</p>
              <p className="text-sm mt-1">Be the first to start chatting!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {onlineUsers
                .filter(user => user.status === "online")
                .map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="relative">
                      <Avatar>
                        <AvatarImage src={user.avatar_url || ""} />
                        <AvatarFallback>
                          {getInitials(user.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-background bg-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">
                          {user.full_name || "Anonymous"}
                        </p>
                        <Badge 
                          variant="outline" 
                          className={cn("text-xs", getBeltColor(user.belt_level))}
                        >
                          Belt {user.belt_level}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {user.country_code.toUpperCase()}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Just now
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              
              {/* Recently offline users */}
              {onlineUsers.filter(user => user.status === "away").length > 0 && (
                <>
                  <Separator className="my-4" />
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Recently Active
                  </h4>
                  {onlineUsers
                    .filter(user => user.status === "away")
                    .map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center gap-3 p-3 rounded-lg border opacity-60"
                      >
                        <Avatar>
                          <AvatarImage src={user.avatar_url || ""} />
                          <AvatarFallback>
                            {getInitials(user.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{user.full_name || "Anonymous"}</p>
                          <p className="text-xs text-muted-foreground">
                            Away • {formatDistanceToNow(new Date(user.last_seen))} ago
                          </p>
                        </div>
                      </div>
                    ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </TabsContent>
      </Tabs>
    </div>
  );
}