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
  DropdownMenuSeparator,
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
  Users,
  Share2,
  Copy,
  Check,
  MessageSquare,
  Clock,
  Loader2,
  Download,
  Shield,
  Zap,
  Info,
  X,
  ChevronDown,
  LogOut,
  Bell,
  Settings,
  User,
} from "lucide-react";
import { deleteMessage, updateMessage } from "@/lib/chatrooms/messages";
import { supportedLanguages, LanguageCode } from "@/lib/chatrooms/languages";
import { translateText } from "@/lib/chatrooms/translation";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  getBeltColor,
  getBeltInfo,
  getChatroomTitle,
  getCurrentProgram,
  getNextBelt,
  getProgressPercentage,
} from "@/lib/constants";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../ui/select";
import { PresenceManager, PresenceUser } from "@/lib/chatrooms/presence";
import { EmojiPickerComponent } from "./EmojiPicker";
import { ChatroomRecord, MessageRow } from "@/lib/chatrooms/types";

type Props = {
  chatroom: ChatroomRecord;
  allowFiles: boolean;
  shareable: boolean;
  initialMessages: MessageRow[];
};

export function ChatroomMessagesEnhanced({
  chatroom,
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
    (supportedLanguages.some((lang) => lang.code === profile?.language)
      ? profile?.language
      : "en") as LanguageCode
  );
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "info" | "members">(
    "chat"
  );
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
    if (!supabase) return;

    // Create the channel with proper configuration
    const channel = supabase
      .channel(`realtime:chatroom:${chatroom.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chatroom_id=eq.${chatroom.id}`,
        },
        async (payload) => {
          console.log("New message received:", payload);

          const newMessage = payload.new as any;

          // Fetch user profile
          const { data: userProfile } = await supabase
            .from("users_profile")
            .select("id, full_name, avatar_url, belt_level, country_code")
            .eq("id", newMessage.user_id)
            .single();

          const messageWithUser: MessageRow = {
            id: newMessage.id,
            user_id: newMessage.user_id,
            content: newMessage.content,
            language: newMessage.language,
            file_url: newMessage.file_url,
            created_at: newMessage.created_at,
            translated_content: newMessage.translated_content || {},
            user: userProfile || null,
          };

          setMessages((prev) => [...prev, messageWithUser]);

          // Optional: Play a sound or show subtle notification
          if (messageWithUser.user_id !== profile?.id) {
            toast.info(`New message from ${userProfile?.full_name || "User"}`);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `chatroom_id=eq.${chatroom.id}`,
        },
        (payload) => {
          console.log("Message updated:", payload);
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
          filter: `chatroom_id=eq.${chatroom.id}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.filter((msg) => msg.id !== payload.old.id)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatroom.id, profile?.id]);

  // Updated presence management in component
  useEffect(() => {
    if (!profile?.id || !supabase) return;

    // Create manager instance
    const manager = new PresenceManager(supabase, chatroom.id);
    presenceManagerRef.current = manager;

    // Set callback
    manager.onUsersChange((users) => {
      const onlineUsers = users.filter((u) => u.status === "online");
      setOnlineUsers(users);
      setOnlineCount(onlineUsers.length);
    });

    // Initialize presence
    const initPresence = async () => {
      if (!profile.id) return;
      try {
        await manager.initialize(profile.id);
      } catch (error) {
        console.error("Failed to initialize presence:", error);
      }
    };

    initPresence();

    return () => {
      if (presenceManagerRef.current) {
        presenceManagerRef.current.destroy();
        presenceManagerRef.current = null;
      }
    };
  }, [profile?.id, chatroom.id]);

  // Separate useEffect for window visibility
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (presenceManagerRef.current) {
        if (document.hidden) {
          await presenceManagerRef.current.setUserStatus("away");
        } else {
          await presenceManagerRef.current.setUserStatus("online");
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

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
        if (fileSizeMB > 10) {
          // 10MB limit
          throw new Error("File size exceeds 10MB limit");
        }

        const fileName = `${Date.now()}-${currentFile.name.replace(
          /[^a-zA-Z0-9.-]/g,
          "_"
        )}`;
        const filePath = `chatrooms/${chatroom.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("chat_uploads")
          .upload(filePath, currentFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("chat_uploads").getPublicUrl(filePath);

        fileUrl = filePath;
        setFileUrls((prev) => ({ ...prev, [filePath]: publicUrl }));
      }

      // Insert message
      const { error: insertError } = await supabase.from("messages").insert({
        user_id: profile.id,
        chatroom_id: chatroom.id,
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
    const shareText = `${message.user?.full_name || "User"}: ${
      message.content
    }`;

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
        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
          {showTranslated ? translated : message.content}
        </p>
        {showTranslated && (
          <div className="group">
            <div
              className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
              onClick={() => {
                /* Toggle original */
              }}
            >
              <ChevronDown className="h-3 w-3 transition-transform group-hover:rotate-180" />
              <span className="font-medium">
                Translated from {message.language}
              </span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 border border-border/50">
              <span className="font-medium block mb-1">Original:</span>
              {message.content}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-background rounded-xl border shadow-sm overflow-hidden">
      {/* Header - Fixed & Responsive */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Logo/Avatar - Always visible */}
          <div className="relative">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-green-500 rounded-full border-2 border-background"></div>
          </div>

          {/* Chat Info - Stack on mobile, row on desktop */}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <h2 className="text-lg sm:text-xl font-semibold truncate">
                {getChatroomTitle(chatroom.type)}
              </h2>
              <Badge
                variant="secondary"
                className="hidden xs:inline-flex rounded-full px-2.5 py-0.5 text-xs font-normal shrink-0"
              >
                <Globe className="h-3 w-3 mr-1" />
                Public
              </Badge>
            </div>

            {/* Online Stats - Show only essential info on mobile */}
            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mt-1">
              <div className="flex items-center gap-1.5">
                <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                <span className="hidden xs:inline">{onlineCount} online</span>
                <span className="xs:hidden">{onlineCount}</span>
              </div>

              <div className="hidden sm:flex items-center gap-3">
                <div className="w-1 h-1 rounded-full bg-muted-foreground/30"></div>
                <span className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Real-time chat</span>
                  <span className="md:hidden">Live</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side Controls - Responsive layout */}
        <div className="flex items-center gap-2">
          {/* Language Selector - Hide on small mobile */}
          <div className="hidden sm:block">
            <Select
              value={targetLang}
              onValueChange={(value) => setTargetLang(value as LanguageCode)}
            >
              <SelectTrigger className="w-[140px] lg:w-[180px] bg-background">
                <div className="flex items-center gap-2 truncate">
                  <Globe className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate hidden lg:inline">
                    Translate to {targetLang.toUpperCase()}
                  </span>
                  <span className="truncate lg:hidden">
                    {targetLang.toUpperCase()}
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent>
                {supportedLanguages.map((lang) => (
                  <SelectItem
                    key={lang.code}
                    value={lang.code}
                    className="flex items-center gap-2"
                  >
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mobile Language Button */}
          <div className="sm:hidden">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-lg"
              onClick={() => {
                /* Open language menu */
              }}
              title="Change Language"
            >
              <Globe className="h-4 w-4" />
            </Button>
          </div>

          {/* Share Button - Hide on mobile */}
          {shareable && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-lg hidden md:inline-flex"
            >
              <Share2 className="h-4 w-4" />
              <span className="hidden lg:inline">Share</span>
            </Button>
          )}

          {/* Share Icon for Mobile */}
          {shareable && (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-lg md:hidden"
              title="Share Room"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          )}

          {/* Menu Button - Always visible */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-lg h-9 w-9"
              >
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onClick={() => {
                  /* Open language selector */
                }}
                className="sm:hidden"
              >
                <Globe className="h-4 w-4 mr-2" />
                Change Language ({targetLang.toUpperCase()})
              </DropdownMenuItem>
              {shareable && (
                <DropdownMenuItem
                  onClick={() => {
                    /* Share action */
                  }}
                  className="md:hidden"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share Room
                </DropdownMenuItem>
              )}
              <DropdownMenuItem>
                <Settings className="h-4 w-4 mr-2" />
                Chat Settings
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Bell className="h-4 w-4 mr-2" />
                Notification Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Leave Chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Content Area with proper overflow handling */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as any)}
          className="h-full flex flex-col"
        >
          {/* Tab Headers - Fixed */}
          <TabsList className="flex-shrink-0 px-6 pt-4 pb-0 bg-transparent border-none h-auto gap-6">
            <TabsTrigger
              value="chat"
              className="data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-3"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
            </TabsTrigger>
            <TabsTrigger
              value="info"
              className="data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-3"
            >
              <Info className="h-4 w-4 mr-2" />
              Room Info
            </TabsTrigger>
            <TabsTrigger
              value="members"
              className="data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-3"
            >
              <Users className="h-4 w-4 mr-2" />
              Members ({onlineCount})
            </TabsTrigger>
          </TabsList>

          {/* Chat Tab Content */}
          <TabsContent
            value="chat"
            className="flex-1 min-h-0 flex flex-col mt-0 p-0 overflow-hidden"
          >
            {/* Scrollable Messages Area */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8">
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-6">
                    <MessageSquare className="h-10 w-10 text-primary/60" />
                  </div>
                  <h3 className="text-2xl font-semibold mb-3 text-center">
                    Welcome to WSF Chat! 🥋
                  </h3>
                  <p className="text-muted-foreground text-center max-w-md mb-6">
                    Connect with fellow WSF members worldwide. Share your Samma
                    journey, ask questions, and build your martial arts
                    community.
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-green-500" />
                      <span>Real-time messaging</span>
                    </div>
                    <div className="w-1 h-1 rounded-full bg-muted-foreground/30"></div>
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-blue-500" />
                      <span>Auto-translation</span>
                    </div>
                    <div className="w-1 h-1 rounded-full bg-muted-foreground/30"></div>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-amber-500" />
                      <span>Safe community</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 sm:p-6">
                  <div className="max-w-4xl mx-auto space-y-4">
                    {messages.map((message) => {
                      const beltInfo =
                        message.user?.belt_level !== undefined
                          ? getBeltInfo(message.user.belt_level)
                          : null;
                      const nextBelt =
                        message.user?.belt_level !== undefined
                          ? getNextBelt(message.user.belt_level)
                          : null;
                      const progressPercentage =
                        message.user?.belt_level !== undefined
                          ? getProgressPercentage(message.user.belt_level)
                          : 0;

                      const expertiseLevel = getCurrentProgram(
                        message.user?.belt_level || 0
                      );

                      return (
                        <div
                          key={message.id}
                          className={cn(
                            "group flex flex-col sm:flex-row gap-3 sm:gap-4 p-4 rounded-2xl transition-all duration-200 hover:bg-muted/30 w-full",
                            message.user_id === profile?.id
                              ? "bg-primary/5 border border-primary/10"
                              : "bg-card border border-border/50"
                          )}
                        >
                          {/* Avatar Section - Full width row on mobile, column on desktop */}
                          <div className="flex items-start gap-3 w-full sm:w-auto">
                            {/* Enhanced Avatar Section */}
                            <div className="relative flex-shrink-0">
                              <div className="relative">
                                {/* Belt Progress Ring */}
                                {beltInfo && (
                                  <div className="absolute -inset-1">
                                    <svg className="w-12 h-12 sm:w-14 sm:h-14 transform -rotate-90">
                                      <circle
                                        cx="24"
                                        cy="24"
                                        r="22"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        fill="none"
                                        className="text-muted-foreground/20"
                                      />
                                      <circle
                                        cx="24"
                                        cy="24"
                                        r="22"
                                        stroke={beltInfo.color}
                                        strokeWidth="2"
                                        fill="none"
                                        strokeDasharray={`${
                                          progressPercentage * 1.38
                                        } 138`}
                                        className="transition-all duration-500"
                                      />
                                    </svg>
                                  </div>
                                )}

                                {/* Avatar */}
                                <Avatar className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl border-2 border-background shadow-sm relative z-10">
                                  <AvatarImage
                                    src={message.user?.avatar_url || ""}
                                    className="rounded-full"
                                  />
                                  <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold rounded-xl text-xs">
                                    {getInitials(
                                      message.user?.full_name ?? null
                                    )}
                                  </AvatarFallback>
                                </Avatar>

                                {/* Belt Level Badge */}
                                {beltInfo && (
                                  <div
                                    className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 border-background flex items-center justify-center shadow-md"
                                    style={{ backgroundColor: beltInfo.color }}
                                    title={`${beltInfo.name} • ${beltInfo.program}`}
                                  >
                                    <span className="text-[9px] sm:text-[10px] font-bold mix-blend-overlay">
                                      {expertiseLevel.level}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Online Status Indicator */}
                              {onlineUsers.find(
                                (user) => user.id === message.user?.id
                              ) && (
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border border-background"></div>
                              )}
                            </div>

                            {/* User Info & Timestamp - Full width on mobile */}
                            <div className="flex-1 min-w-0 sm:hidden">
                              <div className="flex flex-col w-full">
                                <div className="flex items-center justify-between w-full mb-1">
                                  <span className="font-semibold text-sm truncate">
                                    {message.user?.full_name ||
                                      "Anonymous User"}
                                  </span>
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    {formatDistanceToNow(
                                      new Date(message.created_at),
                                      { addSuffix: true }
                                    )}
                                  </span>
                                </div>

                                {/* Mobile Belt Info */}
                                {beltInfo && (
                                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                    <Badge
                                      variant="outline"
                                      className="text-xs py-0.5 px-1.5 border rounded-full truncate"
                                      style={{
                                        borderColor: `${beltInfo.color}40`,
                                        backgroundColor: `${beltInfo.color}90`,
                                      }}
                                    >
                                      {beltInfo.name}
                                    </Badge>

                                    <Badge
                                      variant="secondary"
                                      className="text-[10px] py-0 px-1.5 font-normal"
                                    >
                                      {beltInfo.program.split(" ")[0]}
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Message Content - Full width on all devices */}
                          <div className="flex-1 min-w-0 w-full">
                            {/* Desktop User Info - Hidden on mobile */}
                            <div className="hidden sm:flex items-start justify-between mb-2 w-full">
                              <div className="flex flex-col gap-1 flex-1">
                                {/* User Info with Belt Progress */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-sm">
                                    {message.user?.full_name ||
                                      "Anonymous User"}
                                  </span>

                                  {beltInfo && (
                                    <>
                                      {/* Belt Name Badge */}
                                      <Badge
                                        variant="outline"
                                        className="text-xs py-0.5 px-2 border rounded-full"
                                        style={{
                                          borderColor: `${beltInfo.color}40`,
                                          backgroundColor: `${beltInfo.color}90`,
                                        }}
                                      >
                                        {beltInfo.name}
                                      </Badge>

                                      {/* Program Indicator */}
                                      <Badge
                                        variant="secondary"
                                        className="text-[10px] py-0 px-1.5 font-normal"
                                      >
                                        {beltInfo.program.split(" ")[0]}
                                      </Badge>
                                    </>
                                  )}
                                </div>

                                {/* Progress Bar & Next Belt Info */}
                                {beltInfo && nextBelt && (
                                  <div className="flex items-center gap-2 w-full max-w-xs">
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                                        <span className="truncate">
                                          To {nextBelt.name}
                                        </span>
                                        <span>
                                          {Math.round(progressPercentage)}%
                                        </span>
                                      </div>
                                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                        <div
                                          className="h-full rounded-full transition-all duration-500"
                                          style={{
                                            width: `${progressPercentage}%`,
                                            backgroundColor: beltInfo.color,
                                          }}
                                        ></div>
                                      </div>
                                    </div>

                                    {/* Next Belt Preview */}
                                    <div className="flex items-center gap-1">
                                      <div
                                        className="w-3 h-3 rounded-full"
                                        style={{
                                          backgroundColor: nextBelt.color,
                                        }}
                                        title={`Next: ${nextBelt.name}`}
                                      ></div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Desktop Timestamp & Actions */}
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {formatDistanceToNow(
                                    new Date(message.created_at),
                                    { addSuffix: true }
                                  )}
                                </span>

                                {/* Desktop Message Actions - Show on hover */}
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 rounded-lg"
                                      >
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                      align="end"
                                      className="w-48 rounded-xl"
                                    >
                                      <DropdownMenuItem
                                        onClick={() => {
                                          /* View profile */
                                        }}
                                        className="cursor-pointer rounded-lg"
                                      >
                                        <User className="h-4 w-4 mr-2" />
                                        View Profile
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() =>
                                          copyMessage(
                                            message.content,
                                            message.id
                                          )
                                        }
                                        className="cursor-pointer rounded-lg"
                                      >
                                        {copiedMessageId === message.id ? (
                                          <Check className="h-4 w-4 mr-2 text-green-500" />
                                        ) : (
                                          <Copy className="h-4 w-4 mr-2" />
                                        )}
                                        Copy Text
                                      </DropdownMenuItem>
                                      {shareable && (
                                        <DropdownMenuItem
                                          onClick={() =>
                                            shareMessage(message.id)
                                          }
                                          className="cursor-pointer rounded-lg"
                                        >
                                          <Share2 className="h-4 w-4 mr-2" />
                                          Share Message
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem
                                        onClick={() =>
                                          translateMessage(message)
                                        }
                                        className="cursor-pointer rounded-lg"
                                      >
                                        <Globe className="h-4 w-4 mr-2" />
                                        Translate
                                      </DropdownMenuItem>
                                      {message.user_id === profile?.id && (
                                        <>
                                          <DropdownMenuItem
                                            onClick={() =>
                                              startEdit(
                                                message.id,
                                                message.content
                                              )
                                            }
                                            className="cursor-pointer rounded-lg"
                                          >
                                            <Edit2 className="h-4 w-4 mr-2" />
                                            Edit Message
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            className="text-destructive cursor-pointer rounded-lg focus:text-destructive"
                                            onClick={() =>
                                              removeMessage(message.id)
                                            }
                                          >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Delete Message
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </div>

                            {/* Message Body - Full width on all devices */}
                            <div className="w-full">
                              {editingId === message.id ? (
                                <div className="space-y-3">
                                  <Textarea
                                    value={editText}
                                    onChange={(e) =>
                                      setEditText(e.target.value)
                                    }
                                    autoFocus
                                    className="min-h-[100px] w-full rounded-lg border-2 focus:border-primary"
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={saveEdit}
                                      className="rounded-lg gap-2"
                                    >
                                      <Check className="h-4 w-4" />
                                      Save Changes
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setEditingId(null);
                                        setEditText("");
                                      }}
                                      className="rounded-lg"
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="w-full">
                                  {renderMessageContent(message)}
                                </div>
                              )}

                              {/* File Attachment - Full width */}
                              {message.file_url &&
                                fileUrls[message.file_url] && (
                                  <div className="mt-3 w-full">
                                    <a
                                      href={fileUrls[message.file_url]}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-muted/80 to-muted/50 px-4 py-3 text-sm hover:from-muted hover:to-muted/80 transition-all duration-200 border border-border/50 hover:border-border group w-full"
                                    >
                                      <div className="p-2 rounded-lg bg-background/80 group-hover:bg-background flex-shrink-0">
                                        <File className="h-5 w-5" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate">
                                          {message.file_url.split("/").pop()}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          Click to download
                                        </div>
                                      </div>
                                      <Download className="h-4 w-4 text-muted-foreground group-hover:text-foreground flex-shrink-0" />
                                    </a>
                                  </div>
                                )}
                            </div>

                            {/* Mobile Message Actions - Full width row */}
                            <div className="flex items-center justify-between w-full mt-2 sm:hidden">
                              {/* Mobile Progress Bar */}
                              {beltInfo && nextBelt && (
                                <div className="flex-1 mr-2">
                                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                                    <span className="truncate">
                                      To {nextBelt.name}
                                    </span>
                                    <span>
                                      {Math.round(progressPercentage)}%
                                    </span>
                                  </div>
                                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full transition-all duration-500"
                                      style={{
                                        width: `${progressPercentage}%`,
                                        backgroundColor: beltInfo.color,
                                      }}
                                    ></div>
                                  </div>
                                </div>
                              )}

                              {/* Mobile Actions Button */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 rounded-lg"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="w-48 rounded-xl"
                                >
                                  <DropdownMenuItem
                                    onClick={() => {
                                      /* View profile */
                                    }}
                                    className="cursor-pointer rounded-lg"
                                  >
                                    <User className="h-4 w-4 mr-2" />
                                    View Profile
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      copyMessage(message.content, message.id)
                                    }
                                    className="cursor-pointer rounded-lg"
                                  >
                                    {copiedMessageId === message.id ? (
                                      <Check className="h-4 w-4 mr-2 text-green-500" />
                                    ) : (
                                      <Copy className="h-4 w-4 mr-2" />
                                    )}
                                    Copy Text
                                  </DropdownMenuItem>
                                  {shareable && (
                                    <DropdownMenuItem
                                      onClick={() => shareMessage(message.id)}
                                      className="cursor-pointer rounded-lg"
                                    >
                                      <Share2 className="h-4 w-4 mr-2" />
                                      Share Message
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() => translateMessage(message)}
                                    className="cursor-pointer rounded-lg"
                                  >
                                    <Globe className="h-4 w-4 mr-2" />
                                    Translate
                                  </DropdownMenuItem>
                                  {message.user_id === profile?.id && (
                                    <>
                                      <DropdownMenuItem
                                        onClick={() =>
                                          startEdit(message.id, message.content)
                                        }
                                        className="cursor-pointer rounded-lg"
                                      >
                                        <Edit2 className="h-4 w-4 mr-2" />
                                        Edit Message
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-destructive cursor-pointer rounded-lg focus:text-destructive"
                                        onClick={() =>
                                          removeMessage(message.id)
                                        }
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete Message
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
              )}
            </div>

            {/* Fixed Message Input Area */}
            <div className="flex-shrink-0 border-t bg-card/50 backdrop-blur-sm p-4">
              <div className="max-w-4xl mx-auto">
                {file && (
                  <div className="mb-3 p-3 rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <File className="h-5 w-5 text-primary" />
                      <div>
                        <div className="font-medium text-sm">{file.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} KB • Ready to send
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setFile(null)}
                      className="h-7 w-7 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <div className="relative">
                      <Textarea
                        ref={textareaRef}
                        placeholder="Type message..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        disabled={sending}
                        className="min-h-[56px] max-h-[120px] resize-none rounded-xl border-2 pr-12 focus-visible:ring-0 focus-visible:border-primary"
                      />
                      <div className="absolute right-1 sm:right-3 bottom-3 flex items-center">
                        <EmojiPickerComponent
                          onEmojiSelect={handleEmojiSelect}
                          disabled={sending}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={!allowFiles || sending}
                          className="h-8 w-8 rounded-lg"
                          title="Attach file"
                        >
                          <Paperclip className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          Messages auto-translate to {targetLang.toUpperCase()}
                        </span>
                        {isUploading && (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Uploading file...
                          </span>
                        )}
                      </div>

                      <Button
                        onClick={sendMessage}
                        disabled={(!input.trim() && !file) || sending}
                        className="rounded-full shadow-sm hover:shadow transition-all duration-200"
                        size="icon"
                      >
                        {sending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent
            value="info"
            className="min-h-0 overflow-auto p-2 sm:p-6 h-full overflow-y-auto mt-0"
          >
            <div className="max-w-4xl mx-auto space-y-4">
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
          <TabsContent
            value="members"
            className="min-h-0 overflow-auto p-2 sm:p-6 h-full overflow-y-auto mt-0"
          >
            <div className="max-w-4xl mx-auto space-y-4">
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
                    <p className="text-sm mt-1">
                      Be the first to start chatting!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {onlineUsers
                      .filter((user) => user.status === "online")
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
                                className={cn(
                                  "text-xs",
                                  getBeltColor(user.belt_level)
                                )}
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
                    {onlineUsers.filter((user) => user.status === "away")
                      .length > 0 && (
                      <>
                        <Separator className="my-4" />
                        <h4 className="text-sm font-medium text-muted-foreground">
                          Recently Active
                        </h4>
                        {onlineUsers
                          .filter((user) => user.status === "away")
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
                                <p className="font-medium">
                                  {user.full_name || "Anonymous"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Away •{" "}
                                  {formatDistanceToNow(
                                    new Date(user.last_seen)
                                  )}{" "}
                                  ago
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
    </div>
  );
}
