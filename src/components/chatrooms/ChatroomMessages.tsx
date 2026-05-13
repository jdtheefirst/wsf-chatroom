// components/chatrooms/ChatroomMessagesEnhanced.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { format, formatDistanceToNow } from "date-fns";
import { useAuth } from "@/lib/context/AuthContext";
import { cn, getInitials } from "@/lib/utils";
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
  Crown,
  Calendar,
  Trophy,
  TrendingUp,
  Award,
  Link2,
  BellOff,
  Reply,
  SmilePlus,
  ExternalLink,
  Link,
  Code,
  BookOpen,
  ImageIcon,
  Play,
  FileText,
  Megaphone,
  Verified,
  BarChart3,
  Eye,
  Mic,
  Smile,
  SmileIcon,
  Plus,
  UserPlus,
  MapPin,
  Video,
  Phone,
} from "lucide-react";
import { deleteMessage, updateMessage } from "@/lib/chatrooms/messages";
import { supportedLanguages, LanguageCode } from "@/lib/chatrooms/languages";
import { translateText } from "@/lib/chatrooms/translation";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  beltOptions,
  getBeltColor,
  getBeltInfo,
  getChatroomTitle,
  getCurrentProgram,
  getElitePlusLevelInfo,
  getNextBelt,
  getPriorityBadge,
  getProgressPercentage,
} from "@/lib/constants";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../ui/select";
import { PresenceUser } from "@/lib/chatrooms/presence";
import { EmojiPickerComponent } from "./EmojiPicker";
import { ChatroomRecord, MessageRow } from "@/lib/chatrooms/types";
import { useRouter, useSearchParams } from "next/navigation";
import { LeaderboardItem } from "./LeaderboardItem";
import { Howl } from "howler";
import { ReactionNotification } from "./ReactionNotification";
import LinkPreview from "./LinkPreviews";
import { PrivateReplyNotification } from "./PrivateReplyNotification";
import { BroadcastComposer } from "./BroadcastComposer";
import {
  registerServiceWorker,
  subscribeToPushNotifications,
} from "@/lib/pwa/serviceWorker";
import { useTotalUnreadCount } from "@/lib/hooks/useUnreadMessages";
import { Poll, PollData } from "./Poll";
import { AudioMessage, AudioData } from "./AudioMessage";
import { AudioRecorder } from "./AudioRecorder";
import { PollCreator } from "./PollCreator";
import { EventReference, EventData } from "./EventReference";
import { EventPicker } from "./EventPicker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { useMessageViewTracking } from "@/lib/hooks/useMessageViewTracking";

type Props = {
  chatroom: ChatroomRecord;
  allowFiles: boolean;
  shareable: boolean;
  initialMessages: MessageRow[];
  highlightedMessageId?: string;
};

// Common reaction emojis
const COMMON_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "🤑", "🙌"];

export function ChatroomMessagesEnhanced({
  chatroom,
  allowFiles,
  shareable,
  initialMessages,
  highlightedMessageId,
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
      : "en") as LanguageCode,
  );
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "info" | "members">(
    "chat",
  );
  const [onlineCount, setOnlineCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pickerButtonRef = useRef<HTMLButtonElement>(null);
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const chatTitle = getChatroomTitle(chatroom.type);
  const router = useRouter();
  const highlightedMessageRef = useRef<HTMLDivElement>(null);
  // State to track if we've already scrolled to the highlighted message
  const [hasScrolledToHighlighted, setHasScrolledToHighlighted] =
    useState(false);

  // States for replies and reactions
  const [replyingTo, setReplyingTo] = useState<MessageRow | null>(null);
  const [isPrivateReply, setIsPrivateReply] = useState(false);
  const [showReactionsPicker, setShowReactionsPicker] = useState<string | null>(
    null,
  );
  const [showScrollButton, setShowScrollButton] = useState(true);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const [dailyLeaderboard, setDailyLeaderboard] = useState<any[]>([]);
  const [weeklyLeaderboard, setWeeklyLeaderboard] = useState<any[]>([]);
  const [allTimeLeaderboard, setAllTimeLeaderboard] = useState<any[]>([]);
  const [loadingLeaderboards, setLoadingLeaderboards] = useState(true);
  const [userRank, setUserRank] = useState<{
    position: number;
    messageCount: number;
  } | null>(null);
  const searchParams = useSearchParams();
  const leaderboardRefetchTimeout = useRef<NodeJS.Timeout | null>(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState(false);
  const [soundInstance, setSoundInstance] = useState<Howl | null>(null);
  // Add a different sound for reactions
  const [reactionSound, setReactionSound] = useState<Howl | null>(null);
  const audioPermissionRef = useRef(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [oldestMessageDate, setOldestMessageDate] = useState<string | null>(
    null,
  );
  const { markChatroomAsRead } = useTotalUnreadCount();
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [eventDataMap, setEventDataMap] = useState<Map<string, EventData>>(
    new Map(),
  );
  const { setupTracking, cleanup } = useMessageViewTracking();
  const [pickerState, setPickerState] = useState<{
    messageId: string;
    position: { top: number; left: number };
  } | null>(null);

  // Function to show picker at button position
  const showReactionPicker = (
    messageId: string,
    buttonElement: HTMLButtonElement,
  ) => {
    const rect = buttonElement.getBoundingClientRect();
    const spaceAbove = rect.top;
    const pickerHeight = 100;

    // Calculate position
    let top =
      spaceAbove > pickerHeight
        ? rect.top - pickerHeight - 8 // Show above
        : rect.bottom + 8; // Show below

    setPickerState({
      messageId,
      position: {
        top,
        left: rect.left + rect.width / 2,
      },
    });
  };

  // Run tracking when messages change or when scrolling stops
  useEffect(() => {
    if (messages.length > 0) {
      // Small delay to ensure DOM is updated
      const timer = setTimeout(() => {
        setupTracking();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [messages, setupTracking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Also re-setup when user scrolls (for lazy-loaded messages)
  const handleScroll = useCallback(() => {
    if (messagesContainerRef.current) {
      setupTracking();
    }
  }, [setupTracking]);

  // Add scroll event listener
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll]);

  // Mark chatroom as read when component mounts
  useEffect(() => {
    if (chatroom?.id && profile?.id) {
      // Mark as read after a short delay (user has seen the messages)
      const timer = setTimeout(() => {
        markChatroomAsRead(chatroom.id);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [chatroom?.id, profile?.id]);

  // Add this function to load more messages
  const loadMoreMessages = async () => {
    if (!supabase || loadingMore || !hasMoreMessages) return;

    setLoadingMore(true);
    try {
      const oldestDate = oldestMessageDate || messages[0]?.created_at;

      if (!oldestDate) {
        setHasMoreMessages(false);
        return;
      }

      const { data, error } = await supabase
        .from("messages")
        .select(
          `
        *,
        user_profile:users_profile!messages_user_id_fkey (*)
      `,
        )
        .eq("chatroom_id", chatroom.id)
        .lt("created_at", oldestDate)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      if (data && data.length > 0) {
        // Filter out private replies that user can't see
        const filteredData = profile?.id
          ? filterMessagesForUser(data as MessageRow[], profile.id)
          : (data as MessageRow[]);

        setMessages((prev) => [...filteredData.reverse(), ...prev]);

        if (data.length < 50) {
          setHasMoreMessages(false);
        }
      } else {
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error("Error loading more messages:", error);
      toast.error("Failed to load more messages");
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    // Register service worker on mount
    registerServiceWorker();

    // Check if we should prompt for notifications
    const checkAndPromptNotifications = async () => {
      if ("Notification" in window && Notification.permission === "default") {
        // Wait for user interaction before asking
        const shouldAsk =
          localStorage.getItem("notifications-prompted") !== "true";
        if (shouldAsk) {
          // You can show a custom UI element to ask
          setTimeout(() => {
            const ask = confirm("Enable notifications for new messages?");
            if (ask) {
              subscribeToPushNotifications();
            }
            localStorage.setItem("notifications-prompted", "true");
          }, 5000);
        }
      }
    };

    checkAndPromptNotifications();
  }, []);

  // Add scroll listener for infinite scroll
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (container.scrollTop < 100 && hasMoreMessages && !loadingMore) {
        loadMoreMessages();
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [hasMoreMessages, loadingMore]);

  // Only auto-scroll if there's no highlighted message to jump to
  // OR if we have already scrolled to the highlighted message (to allow auto-scrolling on new messages after jumping)
  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior,
      });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }

    setShowScrollButton(false);
    setIsUserScrolledUp(false);
  };

  // Auto-scroll on new messages only if user hasn't scrolled up
  useEffect(() => {
    // Only auto-scroll if:
    // 1. User hasn't manually scrolled up
    // 2. No highlighted message to jump to, OR we've already scrolled to it
    if (
      !isUserScrolledUp &&
      (!highlightedMessageId || hasScrolledToHighlighted)
    ) {
      scrollToBottom("auto"); // Use "auto" for instant scroll on new messages
    }

    if (chatroom?.id) {
      fetchLeaderboards();
    }

    return () => {
      if (leaderboardRefetchTimeout.current) {
        clearTimeout(leaderboardRefetchTimeout.current);
      }
    };
  }, [messages, chatroom?.id, isUserScrolledUp]); // Add isUserScrolledUp dependency

  // IntersectionObserver to detect when bottom is visible
  useEffect(() => {
    const container = messagesContainerRef.current;
    const bottomSentinel = bottomSentinelRef.current;

    if (!container || !bottomSentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // If the bottom sentinel is visible, we're at the bottom
          const isAtBottom = entry.isIntersecting;
          setIsUserScrolledUp(!isAtBottom);
          setShowScrollButton(!isAtBottom);
        });
      },
      {
        root: container,
        threshold: 0.1,
        rootMargin: "0px",
      },
    );

    observer.observe(bottomSentinel);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Reset highlighted scroll state when highlightedMessageId changes
  useEffect(() => {
    setHasScrolledToHighlighted(false);
  }, [highlightedMessageId]);

  // Load sound and check permission on component mount
  useEffect(() => {
    // Initialize Howl sound (you need to have a sound file in your public folder)
    const sound = new Howl({
      src: ["/sounds/message-notification.wav"],
      volume: 0.5,
      preload: true,
      onloaderror: (id, error) => {
        console.error("Failed to load sound:", error);
      },
    });

    setSoundInstance(sound);

    // Check if user has previously granted permission
    const savedSoundPref = localStorage.getItem("chat-sound-enabled");
    if (savedSoundPref) {
      setIsSoundEnabled(JSON.parse(savedSoundPref));
      audioPermissionRef.current = true;
    }

    return () => {
      sound.unload();
    };
  }, []);

  useEffect(() => {
    // Load reaction sound
    const reactionSoundInstance = new Howl({
      src: ["/sounds/reaction-notification.mp3"], // Different sound for reactions
      volume: 0.4,
      preload: true,
      onloaderror: (id, error) => {
        console.error("Failed to load reaction sound:", error);
      },
    });

    setReactionSound(reactionSoundInstance);

    return () => {
      reactionSoundInstance.unload();
    };
  }, []);

  const playReactionSound = () => {
    if (!reactionSound || !isSoundEnabled) return;

    try {
      reactionSound.play();
    } catch (error) {
      console.error("Error playing reaction sound:", error);
    }
  };

  // Function to request audio permission
  const requestAudioPermission = async () => {
    try {
      // Create a silent audio context to trigger browser permission
      const AudioContext =
        window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContext();

      // Create a silent oscillator
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0; // Silent

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.001);

      // Resume the audio context (this triggers permission prompt in some browsers)
      await audioContext.resume();

      audioPermissionRef.current = true;

      // Schedule the context to close after a short delay
      setTimeout(() => {
        audioContext.close();
      }, 100);

      return true;
    } catch (error) {
      console.error("Audio permission error:", error);
      return false;
    }
  };

  // Function to play sound
  const playMessageSound = () => {
    if (!soundInstance || !isSoundEnabled) return;

    try {
      soundInstance.play();
    } catch (error) {
      console.error("Error playing sound:", error);
    }
  };

  // Function to toggle sound
  const toggleSound = async () => {
    if (!isSoundEnabled) {
      // If enabling sound, request permission first
      const hasPermission = await requestAudioPermission();
      if (hasPermission) {
        setIsSoundEnabled(true);
        localStorage.setItem("chat-sound-enabled", "true");
        toast.success("Sound notifications enabled");
      } else {
        toast.error("Could not enable sound notifications");
      }
    } else {
      setIsSoundEnabled(false);
      localStorage.setItem("chat-sound-enabled", "false");
      toast.info("Sound notifications disabled");
    }
  };

  // Fetch leaderboards
  const fetchLeaderboards = async () => {
    if (!chatroom?.id) return;

    try {
      setLoadingLeaderboards(true);

      const response = await fetch(
        `/api/chatrooms/leaderboard?chatroomId=${chatroom.id}`,
      );
      if (response.ok) {
        const data = await response.json();
        setDailyLeaderboard(data.daily || []);
        setWeeklyLeaderboard(data.weekly || []);
        setAllTimeLeaderboard(data.allTime || []);

        // Find current user's rank in all-time
        if (profile?.id && data.allTime) {
          const userIndex = data.allTime.findIndex(
            (item: any) => item.user.id === profile.id,
          );
          if (userIndex !== -1) {
            setUserRank({
              position: userIndex + 1,
              messageCount: data.allTime[userIndex].messageCount,
            });
          } else {
            setUserRank(null);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching leaderboards:", error);
    } finally {
      setLoadingLeaderboards(false);
    }
  };

  // Handle highlighted message scrolling
  useEffect(() => {
    if (
      highlightedMessageId &&
      messages.length > 0 &&
      !hasScrolledToHighlighted
    ) {
      // Find the message in the current messages
      const messageExists = messages.some(
        (msg) => msg.id === highlightedMessageId,
      );

      if (messageExists) {
        // Wait a bit for the DOM to render
        const timer = setTimeout(() => {
          if (highlightedMessageRef.current) {
            highlightedMessageRef.current.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });

            // Add visual highlight effect
            highlightedMessageRef.current.classList.add("highlight-pulse");
            setTimeout(() => {
              highlightedMessageRef.current?.classList.remove(
                "highlight-pulse",
              );
            }, 2000);

            // Mark that we've scrolled to the highlighted message
            setHasScrolledToHighlighted(true);

            // Clear the URL parameter after successful scroll
            const newSearchParams = new URLSearchParams(
              searchParams.toString(),
            );
            newSearchParams.delete("messageId");
            router.replace(`?${newSearchParams.toString()}`, { scroll: false });
          }
        }, 100);

        return () => clearTimeout(timer);
      }
    }
  }, [
    highlightedMessageId,
    messages,
    hasScrolledToHighlighted,
    searchParams,
    router,
  ]);

  // Update the shareMessage function
  const shareMessage = async (messageId: string) => {
    if (!shareable) {
      toast.error("This chatroom is not shareable");
      return;
    }

    const message = messages.find((m) => m.id === messageId);
    if (!message) return;

    // Create URL with messageId parameter - updated to include full URL
    const shareUrl = `${window.location.origin}/chatrooms/${chatroom.id}?messageId=${messageId}`;

    // Use Web Share API if available
    if (navigator.share) {
      try {
        await navigator.share({
          title: `WSF Chat: ${message.user_profile?.full_name || "User"}`,
          text:
            message.content.length > 100
              ? `${message.content.substring(0, 100)}...`
              : message.content,
          url: shareUrl,
        });
        toast.success("Message shared!");
      } catch (err) {
        // User cancelled share or share failed
        console.log("Share cancelled:", err);
        // Fallback to clipboard
        await copyMessage(shareUrl, messageId);
      }
    } else {
      // Fallback: copy link to clipboard
      await copyMessage(shareUrl, messageId);
      toast.success("Link copied to clipboard!");
    }
  };

  // Realtime subscription for messages
  // Enhanced realtime subscription for reactions and replies
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
            .select(
              "id, full_name, admission_no, avatar_url, belt_level, country_code, elite_plus, overall_performance, completed_all_programs, elite_plus_level, is_wsf",
            )
            .eq("id", newMessage.user_id)
            .single();

          const messageWithUser: MessageRow = {
            id: newMessage.id,
            user_id: newMessage.user_id,
            content: newMessage.content,
            language: newMessage.language,
            file_url: newMessage.file_url,
            reply_to: newMessage.reply_to,
            reply_is_private: newMessage.reply_is_private || false,
            created_at: newMessage.created_at,
            translated_content: newMessage.translated_content || {},
            user_profile: userProfile || null,
            reactions_count: newMessage.reactions_count || {},
            user_reactions: [],
            priority: newMessage.priority || "normal",
            is_broadcast: newMessage.is_broadcast || false,
            view_count: newMessage.view_count || 0,
            event_id: newMessage.event_id || null,
            event_reminder_data: newMessage.event_reminder_data || null,
            poll_data: newMessage.poll_data || null,
            audio_data: newMessage.audio_data || null,
            scheduled_at: newMessage.scheduled_at || null,
          };

          let replied;

          // If this is a reply, fetch the replied message
          if (newMessage.reply_to) {
            const { data: repliedMessage } = await supabase
              .from("messages")
              .select(
                `
          *,
          user_profile:users_profile!messages_user_id_fkey (
            id, full_name, admission_no, avatar_url, belt_level, 
            country_code, elite_plus, overall_performance, 
            completed_all_programs, elite_plus_level, is_wsf
          )
        `,
              )
              .eq("id", newMessage.reply_to)
              .single();

            if (repliedMessage) {
              messageWithUser.reply_to_message = repliedMessage as MessageRow;
              replied = repliedMessage;
            }
          }

          // Check if this is a private reply and current user can see it
          if (newMessage.reply_is_private && profile?.id) {
            // Apply client-side filtering for private replies
            const canView =
              newMessage.user_id === profile.id ||
              (replied && replied.user_id === profile.id);

            if (!canView) {
              // Don't add private replies that user can't see
              return;
            }
          }

          setMessages((prev) => [...prev, messageWithUser]);

          // Check if message is from another user and play sound
          if (messageWithUser.user_id !== profile?.id) {
            // Show notification
            const notificationText = newMessage.reply_is_private
              ? `Private reply from ${userProfile?.full_name || "User"}`
              : `New message from ${userProfile?.full_name || "User"}`;

            toast.info(notificationText);

            // Play sound if enabled
            playMessageSound();

            // Optional: Trigger browser notification if user is not focused on tab
            if (document.hidden && "Notification" in window) {
              if (Notification.permission === "granted") {
                new Notification(
                  `New message from ${userProfile?.full_name || "User"}`,
                  {
                    body:
                      messageWithUser.content.length > 50
                        ? `${messageWithUser.content.substring(0, 50)}...`
                        : messageWithUser.content,
                    icon: userProfile?.avatar_url || "/default-avatar.png",
                    tag: `message-${messageWithUser.id}`,
                    renotify: true,
                  } as any,
                );
              }
            }

            // Only send push if the document is hidden (user not active on site)
            if (document.hidden) {
              // Call your API to send push notification
              fetch("/api/pwa/send-notification", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  message: {
                    id: messageWithUser.id,
                    content: messageWithUser.content,
                    user_name: messageWithUser.user_profile?.full_name,
                    user_avatar: messageWithUser.user_profile?.avatar_url,
                  },
                  chatroomId: chatroom.id,
                  recipientUserId: profile?.id,
                }),
              }).catch((err) => console.error("Failed to send push:", err));
            }
          }

          // Debounce leaderboard updates
          if (leaderboardRefetchTimeout.current) {
            clearTimeout(leaderboardRefetchTimeout.current);
          }

          leaderboardRefetchTimeout.current = setTimeout(() => {
            fetchLeaderboards();
          }, 2000);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `chatroom_id=eq.${chatroom.id}`,
        },
        async (payload) => {
          const updatedMessage = payload.new as any;

          // Update message in state
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === payload.new.id
                ? {
                    ...msg,
                    ...updatedMessage,
                    reactions_count: updatedMessage.reactions_count || {},
                  }
                : msg,
            ),
          );

          // If reactions count changed, fetch reactions
          if (updatedMessage.reactions_count) {
            fetchAllMessageReactionsOptimized();
          }
        },
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
            prev.filter((msg) => msg.id !== payload.old.id),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_reactions",
        },
        async (payload) => {
          const reaction = payload.new as any;

          if (payload.eventType === "INSERT") {
            // Update reactions count in message
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id === reaction.message_id) {
                  const currentCount = msg.reactions_count || {};
                  const newCount = {
                    ...currentCount,
                    [reaction.emoji]: (currentCount[reaction.emoji] || 0) + 1,
                  };

                  const userReactions = msg.user_reactions || [];
                  if (
                    reaction.user_id === profile?.id &&
                    !userReactions.includes(reaction.emoji)
                  ) {
                    userReactions.push(reaction.emoji);
                  }

                  return {
                    ...msg,
                    reactions_count: newCount,
                    user_reactions: userReactions,
                  };
                }
                return msg;
              }),
            );
          } else if (payload.eventType === "DELETE") {
            const oldReaction = payload.old as any;

            // Update reactions count in message
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id === oldReaction.message_id) {
                  const currentCount = msg.reactions_count || {};
                  const newCount = { ...currentCount };

                  if (newCount[oldReaction.emoji]) {
                    newCount[oldReaction.emoji]--;
                    if (newCount[oldReaction.emoji] <= 0) {
                      delete newCount[oldReaction.emoji];
                    }
                  }

                  const userReactions = (msg.user_reactions || []).filter(
                    (emoji: string) => emoji !== oldReaction.emoji,
                  );

                  return {
                    ...msg,
                    reactions_count: newCount,
                    user_reactions: userReactions,
                  };
                }
                return msg;
              }),
            );
          }
        },
      )
      .subscribe();

    const pollVotesChannel = supabase
      .channel(`poll_votes:${chatroom.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "poll_votes",
        },
        async (payload) => {
          const newVote = payload.new;

          // Ignore current user's votes (already handled by optimistic update)
          if (newVote.user_id === profile?.id) return;

          // Update the poll data in real-time
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === newVote.message_id && msg.poll_data) {
                const pollData = msg.poll_data;

                // Check if user already has this vote in their local data
                const alreadyCounted = pollData.options.some(
                  (opt) =>
                    opt.id === newVote.option_id &&
                    pollData.user_votes?.includes(newVote.option_id),
                );

                if (alreadyCounted) return msg;

                return {
                  ...msg,
                  poll_data: {
                    ...pollData,
                    total_votes: pollData.total_votes + 1,
                    options: pollData.options.map((opt) =>
                      opt.id === newVote.option_id
                        ? { ...opt, vote_count: opt.vote_count + 1 }
                        : opt,
                    ),
                  },
                };
              }
              return msg;
            }),
          );
        },
      )
      .subscribe();

    return () => {
      if (leaderboardRefetchTimeout.current) {
        clearTimeout(leaderboardRefetchTimeout.current);
      }
      supabase.removeChannel(channel);
      supabase.removeChannel(pollVotesChannel);
    };
  }, [chatroom.id, profile?.id, isSoundEnabled, soundInstance, messages]);

  // Fetch reactions for existing messages on mount
  useEffect(() => {
    if (messages.length > 0) {
      messages.forEach((message) => {
        fetchAllMessageReactionsOptimized();
      });
    }
  }, [messages.length, profile?.id]);

  const filterMessagesForUser = (
    messages: MessageRow[],
    userId: string,
  ): MessageRow[] => {
    return messages.filter((message) => {
      // If not a private reply, include it
      if (!message.reply_is_private) {
        return true;
      }

      // If private reply, check if user can see it
      if (!message.reply_to_message) {
        return true; // Shouldn't happen, but include it
      }

      // User can see private reply if they are the author or the recipient
      return (
        message.user_id === userId ||
        message.reply_to_message.user_id === userId
      );
    });
  };

  // Use this function when setting or updating messages
  useEffect(() => {
    if (profile?.id) {
      const filteredMessages = filterMessagesForUser(
        initialMessages,
        profile.id,
      );
      setMessages(filteredMessages);
    } else {
      setMessages(initialMessages);
    }
  }, [initialMessages, profile?.id]);

  // After fetching messages
  useEffect(() => {
    const urls: Record<string, string> = {};

    messages.forEach((message) => {
      if (message.file_url) {
        // Generate public URL for each file
        const {
          data: { publicUrl },
        } = supabase.storage
          .from("chat-attachments")
          .getPublicUrl(message.file_url);

        urls[message.file_url] = publicUrl;
      }
    });

    setFileUrls(urls);
  }, [messages]);

  useEffect(() => {
    const hydrateMessages = async () => {
      let updatedMessages = messages;
      let needsUpdate = false;

      // Check if any messages need reply hydration
      const needsReplyHydration = messages.some(
        (msg) => msg.reply_to && !msg.reply_to_message,
      );

      if (needsReplyHydration) {
        const hydratedMessages = await hydrateReplyMessages(messages);
        if (JSON.stringify(hydratedMessages) !== JSON.stringify(messages)) {
          updatedMessages = hydratedMessages;
          needsUpdate = true;
        }
      }

      // Check if any messages need poll vote hydration
      const needsPollHydration = messages.some(
        (msg) =>
          msg.poll_data &&
          (!msg.poll_data.user_votes || msg.poll_data.user_votes.length === 0),
      );

      if (needsPollHydration) {
        const hydratedWithVotes = await hydratePollVotes(updatedMessages);
        if (
          JSON.stringify(hydratedWithVotes) !== JSON.stringify(updatedMessages)
        ) {
          updatedMessages = hydratedWithVotes;
          needsUpdate = true;
        }
      }

      // Only update state if something changed
      if (needsUpdate) {
        setMessages(updatedMessages);
      }
    };

    hydrateMessages();
  }, [messages, profile?.id]);

  // Presence management - WORKING VERSION
  useEffect(() => {
    if (!profile?.id || !supabase || !chatroom?.id) return;

    let presenceChannel: any = null;
    let heartbeatInterval: NodeJS.Timeout;

    const initPresence = async () => {
      try {
        // Get user data once
        const userData = {
          full_name: profile.full_name,
          admission_no: profile.admission_no,
          avatar_url: profile.avatar_url,
          belt_level: profile.belt_level || 0,
          country_code: profile.country_code || "unknown",
          elite_plus: profile.elite_plus,
          overall_performance: profile.overall_performance,
          completed_all_programs: profile.completed_all_programs,
          elite_plus_level: profile.elite_plus_level,
          is_wsf: profile.is_wsf,
        };

        if (!userData) {
          console.error("Failed to get user data");
          return;
        }

        // Create presence channel
        presenceChannel = supabase.channel(`room:${chatroom.id}`, {
          config: {
            presence: {
              key: profile.id,
            },
          },
        });

        // Store processing function
        const processAndUpdate = () => {
          if (!presenceChannel) return;

          const state = presenceChannel.presenceState();

          const users = processPresenceState(state);
          setOnlineUsers(users);
          setOnlineCount(users.filter((u) => u.status === "online").length);
        };

        presenceChannel
          .on("presence", { event: "sync" }, () => {
            processAndUpdate();
          })
          .on("presence", { event: "join" }, ({ key, newPresences }: any) => {
            processAndUpdate();
          })
          .on("presence", { event: "leave" }, ({ key }: any) => {
            processAndUpdate();
          })
          .subscribe(async (status: string, error?: any) => {
            if (status === "SUBSCRIBED") {
              // IMPORTANT: Track with the user data directly in the root object
              await presenceChannel.track({
                // Put user data directly in the root
                full_name: userData.full_name,
                admission_no: userData.admission_no,
                avatar_url: userData.avatar_url,
                belt_level: userData.belt_level,
                country_code: userData.country_code,
                online_at: new Date().toISOString(),
              });

              // Start heartbeat
              heartbeatInterval = setInterval(async () => {
                if (presenceChannel) {
                  await presenceChannel.track({
                    full_name: userData.full_name,
                    admission_no: userData.admission_no,
                    avatar_url: userData.avatar_url,
                    belt_level: userData.belt_level,
                    country_code: userData.country_code,
                    elite_plus: userData.elite_plus,
                    overall_performance: userData.overall_performance,
                    completed_all_programs: userData.completed_all_programs,
                    elite_plus_level: userData.elite_plus_level,
                    is_wsf: userData.is_wsf,
                    online_at: new Date().toISOString(),
                  });
                  processAndUpdate();
                }
              }, 15000);

              // Initial update after a short delay
              setTimeout(() => {
                processAndUpdate();
              }, 1000);
            }
          });
      } catch (error) {
        console.error("Error initializing presence:", error);
      }
    };

    const processPresenceState = (state: any): PresenceUser[] => {
      const now = Date.now();
      const users: PresenceUser[] = [];

      if (!state || typeof state !== "object") {
        return users;
      }

      Object.entries(state).forEach(
        ([userId, presenceEntries]: [string, any]) => {
          // Supabase presence is always an array
          const presenceArray = Array.isArray(presenceEntries)
            ? presenceEntries
            : [presenceEntries];

          if (presenceArray.length === 0) {
            return;
          }

          // Get the latest presence entry (first one is usually latest)
          const presence = presenceArray[0];

          if (presence && typeof presence === "object") {
            // Extract data - it's directly in the presence object
            const full_name = presence.full_name || "Unknown User";
            const admission_no = presence.admission_no;
            const avatar_url = presence.avatar_url;
            const belt_level = presence.belt_level || 0;
            const country_code = presence.country_code || "unknown";
            const elite_plus = presence.elite_plus;
            const overall_performance = presence.overall_performance;
            const completed_all_programs = presence.completed_all_programs;
            const elite_plus_level = presence.elite_plus_level;
            const online_at = presence.online_at;
            const is_wsf = presence.is_wsf;

            const lastSeen = online_at ? new Date(online_at).getTime() : now;

            const isAway = now - lastSeen > 45000;

            users.push({
              id: userId,
              full_name,
              admission_no,
              avatar_url,
              belt_level,
              country_code,
              elite_plus,
              overall_performance,
              completed_all_programs,
              elite_plus_level,
              is_wsf,
              last_seen: lastSeen,
              status: isAway ? "away" : "online",
            });
          }
        },
      );
      return users;
    };

    initPresence();

    return () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      if (presenceChannel) {
        supabase.removeChannel(presenceChannel);
      }
    };
  }, [profile?.id, chatroom?.id]);

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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    } else if (e.key === "Escape" && replyingTo) {
      cancelReply();
    }
  };

  // Function to hydrate reply messages - IMPROVED VERSION
  const hydrateReplyMessages = async (messagesToHydrate: MessageRow[]) => {
    // Filter out messages that current user can't see (private replies)
    const visibleMessages = messagesToHydrate.filter((msg) => {
      if (!msg.reply_is_private) return true;
      if (!profile?.id) return false;

      // User can see private reply if they are author or recipient
      const isAuthor = msg.user_id === profile.id;
      const isRecipient = msg.reply_to_message?.user_id === profile.id;

      return isAuthor || isRecipient;
    });

    // Find messages that need hydration
    const messagesNeedingHydration = visibleMessages.filter(
      (msg) => msg.reply_to && !msg.reply_to_message,
    );

    if (messagesNeedingHydration.length === 0) {
      return visibleMessages;
    }

    try {
      // Get all unique reply IDs
      const replyIds = [
        ...new Set(messagesNeedingHydration.map((msg) => msg.reply_to)),
      ];

      // Fetch all replied messages in one query
      const { data: repliedMessages, error } = await supabase
        .from("messages")
        .select(
          `
        *,
        user_profile:users_profile!messages_user_id_fkey (
          id, full_name, admission_no, avatar_url, belt_level, 
          country_code, elite_plus, overall_performance, 
          completed_all_programs, elite_plus_level, is_wsf
        )
      `,
        )
        .in("id", replyIds);

      if (error) throw error;

      // Create a map for quick lookup
      const repliedMessagesMap = new Map();
      repliedMessages?.forEach((msg) => {
        repliedMessagesMap.set(msg.id, msg);
      });

      // Hydrate the messages
      return visibleMessages.map((msg) => {
        if (msg.reply_to && !msg.reply_to_message) {
          const repliedMessage = repliedMessagesMap.get(msg.reply_to);
          if (repliedMessage) {
            return {
              ...msg,
              reply_to_message: repliedMessage as MessageRow,
            };
          }
        }
        return msg;
      });
    } catch (error) {
      console.error("Error hydrating reply messages:", error);
      return visibleMessages;
    }
  };

  // Function to hydrate poll votes for messages
  const hydratePollVotes = async (messagesToHydrate: MessageRow[]) => {
    if (!profile?.id) return messagesToHydrate;

    // Find messages that have polls but no user_votes
    const messagesNeedingVotes = messagesToHydrate.filter(
      (msg) =>
        msg.poll_data &&
        (!msg.poll_data.user_votes || msg.poll_data.user_votes.length === 0),
    );

    if (messagesNeedingVotes.length === 0) {
      return messagesToHydrate;
    }

    try {
      // Get all unique message IDs that need votes
      const messageIds = messagesNeedingVotes.map((msg) => msg.id);

      // Fetch user's votes for these messages
      const { data: userVotes, error } = await supabase
        .from("poll_votes")
        .select("message_id, option_id")
        .in("message_id", messageIds)
        .eq("user_id", profile.id);

      if (error) throw error;

      // Create a map for quick lookup (message_id -> array of option_ids)
      const votesMap = new Map();
      userVotes?.forEach((vote) => {
        if (!votesMap.has(vote.message_id)) {
          votesMap.set(vote.message_id, []);
        }
        votesMap.get(vote.message_id).push(vote.option_id);
      });

      // Hydrate messages with user_votes
      return messagesToHydrate.map((msg) => {
        if (msg.poll_data && votesMap.has(msg.id)) {
          return {
            ...msg,
            poll_data: {
              ...msg.poll_data,
              user_votes: votesMap.get(msg.id),
            },
          };
        }
        return msg;
      });
    } catch (error) {
      console.error("Error hydrating poll votes:", error);
      return messagesToHydrate;
    }
  };

  // Function to fetch reactions for a message
  // Final optimized version
  const fetchAllMessageReactionsOptimized = async () => {
    if (!supabase || messages.length === 0) return;

    try {
      const messageIds = messages.map((msg) => msg.id);

      // Single query for all reactions
      const { data, error } = await supabase
        .from("message_reactions")
        .select("message_id, emoji, user_id")
        .in("message_id", messageIds);

      if (error) throw error;

      // Efficient processing with Maps
      const reactionsCountMap = new Map<string, Map<string, number>>(); // message_id -> Map<emoji, count>
      const userReactionsMap = new Map<string, Set<string>>(); // message_id -> Set<emoji> for current user

      data?.forEach(({ message_id, emoji, user_id }) => {
        // Initialize maps if needed
        if (!reactionsCountMap.has(message_id)) {
          reactionsCountMap.set(message_id, new Map());
        }
        if (!userReactionsMap.has(message_id)) {
          userReactionsMap.set(message_id, new Set());
        }

        // Update counts
        const emojiMap = reactionsCountMap.get(message_id)!;
        emojiMap.set(emoji, (emojiMap.get(emoji) || 0) + 1);

        // Update user reactions
        if (user_id === profile?.id) {
          userReactionsMap.get(message_id)!.add(emoji);
        }
      });

      // Update messages in a single pass
      setMessages((prev) =>
        prev.map((msg) => {
          const messageId = msg.id;
          const emojiMap = reactionsCountMap.get(messageId);
          const userReactionSet = userReactionsMap.get(messageId);

          if (!emojiMap && !userReactionSet) return msg;

          // Convert Map to object for reactions_count
          const reactionsCount: Record<string, number> = {};
          if (emojiMap) {
            emojiMap.forEach((count, emoji) => {
              reactionsCount[emoji] = count;
            });
          }

          return {
            ...msg,
            reactions_count: reactionsCount,
            user_reactions: userReactionSet ? Array.from(userReactionSet) : [],
          };
        }),
      );
    } catch (error) {
      console.error("Error fetching reactions:", error);
    }
  };

  // Function to add/remove reaction
  // Function to add/remove reaction
  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!profile?.id) {
      toast.error("Please sign in to react");
      return;
    }

    try {
      const message = messages.find((m) => m.id === messageId);
      const hasReacted = message?.user_reactions?.includes(emoji);

      if (hasReacted) {
        // Remove reaction
        const { error } = await supabase
          .from("message_reactions")
          .delete()
          .eq("message_id", messageId)
          .eq("user_id", profile.id)
          .eq("emoji", emoji);

        if (error) throw error;
        toast.success("Reaction removed");

        // Update UI immediately for better UX
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === messageId) {
              const currentCount = msg.reactions_count || {};
              const newCount = { ...currentCount };

              if (newCount[emoji]) {
                newCount[emoji]--;
                if (newCount[emoji] <= 0) {
                  delete newCount[emoji];
                }
              }

              const userReactions = (msg.user_reactions || []).filter(
                (e) => e !== emoji,
              );

              return {
                ...msg,
                reactions_count: newCount,
                user_reactions: userReactions,
              };
            }
            return msg;
          }),
        );
      } else {
        // Add reaction
        const { error } = await supabase.from("message_reactions").insert({
          message_id: messageId,
          user_id: profile.id,
          emoji: emoji,
        });

        if (error) {
          // If unique constraint violation, remove it
          if (error.code === "23505") {
            await supabase
              .from("message_reactions")
              .delete()
              .eq("message_id", messageId)
              .eq("user_id", profile.id)
              .eq("emoji", emoji);
          } else {
            throw error;
          }
        }

        toast.success("Reaction added");

        // Update UI immediately for better UX
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === messageId) {
              const currentCount = msg.reactions_count || {};
              const newCount = {
                ...currentCount,
                [emoji]: (currentCount[emoji] || 0) + 1,
              };

              const userReactions = [...(msg.user_reactions || []), emoji];

              return {
                ...msg,
                reactions_count: newCount,
                user_reactions: userReactions,
              };
            }
            return msg;
          }),
        );
      }

      fetchAllMessageReactionsOptimized();
    } catch (error) {
      console.error("Error toggling reaction:", error);
      toast.error("Failed to update reaction");
    }
  };
  // Function to handle reply
  // Function to handle reply - IMPROVED
  const handleReply = (message: MessageRow) => {
    setReplyingTo(message);
    setIsPrivateReply(false); // Reset to default (public)

    // Store the username separately
    const username = message.user_profile?.full_name || "User";
    setInput(`@${username} `);

    // Focus the textarea
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(
        username.length + 2, // Position after "@username "
        username.length + 2,
      );
      textareaRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  // Function to cancel reply
  const cancelReply = () => {
    // Clear the reply but keep the @username if user has typed after it
    if (
      replyingTo &&
      input.startsWith(`@${replyingTo.user_profile?.full_name || "User"} `)
    ) {
      setInput(`@${replyingTo.user_profile?.full_name || "User"} `);
    }
    setReplyingTo(null);
    setIsPrivateReply(false); // Reset when cancelling reply
  };

  // Enhanced sendMessage function with reply support
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
    const replyToId = replyingTo?.id;
    const privateReply = isPrivateReply && replyToId ? true : false;

    setInput("");
    setFile(null);
    setReplyingTo(null);
    setIsPrivateReply(false); // Reset after sending

    try {
      let fileUrl: string | null = null;

      // Handle file upload
      if (currentFile && allowFiles) {
        const fileSizeMB = currentFile.size / (1024 * 1024);
        if (fileSizeMB > 10) {
          throw new Error("File size exceeds 10MB limit");
        }

        const fileName = `${Date.now()}-${currentFile.name.replace(
          /[^a-zA-Z0-9.-]/g,
          "_",
        )}`;
        const filePath = `${chatroom.id}/${profile.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("chat-attachments")
          .upload(filePath, currentFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("chat-attachments").getPublicUrl(filePath);

        fileUrl = filePath;
        console.log("File uploaded to Supabase Storage:", publicUrl);
        setFileUrls((prev) => ({ ...prev, [filePath]: publicUrl }));
      }

      // Insert message with reply
      const { error: insertError } = await supabase.from("messages").insert({
        user_id: profile.id,
        chatroom_id: chatroom.id,
        content: text || "(File attached)",
        language: profile?.language || "en",
        file_url: fileUrl,
        reply_to: replyToId,
        reply_is_private: privateReply,
        translated_content: {},
      });

      if (insertError) throw insertError;

      toast.success("Message sent!");

      // Debounce leaderboard updates
      if (leaderboardRefetchTimeout.current) {
        clearTimeout(leaderboardRefetchTimeout.current);
      }
      leaderboardRefetchTimeout.current = setTimeout(() => {
        fetchLeaderboards();
      }, 2000);
    } catch (err: any) {
      console.error("Send message error:", err);
      toast.error(err.message || "Failed to send message");
      setInput(text); // Restore text if error
      if (replyingTo) {
        setReplyingTo(replyingTo);
        setIsPrivateReply(privateReply); // Restore private reply state if error
      }
    } finally {
      setSending(false);
      setIsUploading(false);
      textareaRef.current?.focus();
    }
  };

  // Function to handle file selection (FIXED - now used)
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

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
      // Optimistically update UI
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
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
            : msg,
        ),
      );

      toast.dismiss();
      toast.success("Translation complete!");
    } catch (err) {
      toast.dismiss();
      toast.error("Translation failed");
    }
  };

  // ============ POLL FUNCTIONS ============
  const generateWaveform = async (audioBlob: Blob): Promise<number[]> => {
    return new Promise((resolve) => {
      const audioContext = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
      const reader = new FileReader();

      reader.onloadend = async () => {
        const arrayBuffer = reader.result as ArrayBuffer;
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const channelData = audioBuffer.getChannelData(0);

        const samples = 40;
        const blockSize = Math.floor(channelData.length / samples);
        const waveform = [];

        for (let i = 0; i < samples; i++) {
          let blockStart = i * blockSize;
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(channelData[blockStart + j]);
          }
          waveform.push(sum / blockSize);
        }

        const max = Math.max(...waveform);
        const normalized = waveform.map((v) => v / max);
        resolve(normalized);
      };

      reader.readAsArrayBuffer(audioBlob);
    });
  };

  const createPoll = async (
    question: string,
    options: string[],
    optionImages: { file: File; index: number }[],
    isMultiSelect: boolean,
    durationDays: number,
  ) => {
    if (!profile) return;

    // Validate IDs
    if (!chatroom?.id || !profile?.id) {
      toast.error("Missing chatroom or user information");
      return;
    }

    try {
      // Initialize image URLs array with nulls
      const imageUrls: (string | null)[] = new Array(options.length).fill(null);

      // Upload only images that exist - MATCH THE AUDIO PATTERN
      if (optionImages.length > 0) {
        const uploadPromises = optionImages.map(async ({ file, index }) => {
          // Create a unique filename - same pattern as audio
          const timestamp = Date.now();
          const randomId = crypto.randomUUID();
          const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
          const fileName = `poll_${timestamp}_${randomId}_${index}_${sanitizedFileName}`;

          // DON'T use "polls/" folder - use same pattern as audio
          const filePath = `${chatroom.id}/${profile.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from("chat-attachments")
            .upload(filePath, file, {
              cacheControl: "3600",
              contentType: file.type,
              upsert: false,
            });

          if (uploadError) {
            console.error(`Upload error for option ${index}:`, uploadError);
            throw uploadError;
          }

          const {
            data: { publicUrl },
          } = supabase.storage.from("chat-attachments").getPublicUrl(filePath);

          return { index, url: publicUrl };
        });

        const uploadedResults = await Promise.all(uploadPromises);

        // Place URLs at their correct indices
        uploadedResults.forEach(({ index, url }) => {
          imageUrls[index] = url;
        });
      }

      // Generate option IDs
      const optionIds = options.map(() => crypto.randomUUID());

      // Prepare poll data
      const pollData: PollData = {
        question,
        is_multi_select: isMultiSelect,
        expires_at: new Date(
          Date.now() + durationDays * 24 * 60 * 60 * 1000,
        ).toISOString(),
        total_votes: 0,
        options: options.map((text, idx) => ({
          id: optionIds[idx],
          text,
          image_url: imageUrls[idx],
          vote_count: 0,
        })),
        user_votes: [],
      };

      // Create message with poll
      const { error } = await supabase.from("messages").insert({
        user_id: profile.id,
        chatroom_id: chatroom.id,
        content: `📊 POLL: ${question.substring(0, 100)}`,
        language: profile?.language || "en",
        poll_data: pollData,
      });

      if (error) throw error;

      toast.success("Poll created successfully!");
    } catch (error) {
      console.error("Error creating poll:", error);
      toast.error("Failed to create poll");
      throw error;
    }
  };

  const voteOnPoll = async (messageId: string, optionId: string) => {
    if (!profile) return;

    // Optimistic update - update UI immediately
    const originalMessages = [...messages];
    const messageIndex = messages.findIndex((msg) => msg.id === messageId);

    if (messageIndex === -1) return;

    const originalPollData = messages[messageIndex].poll_data;

    // Apply optimistic update
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === messageId && msg.poll_data) {
          const pollData = msg.poll_data;
          return {
            ...msg,
            poll_data: {
              ...pollData,
              total_votes: pollData.total_votes + 1,
              options: pollData.options.map((opt) =>
                opt.id === optionId
                  ? { ...opt, vote_count: opt.vote_count + 1 }
                  : opt,
              ),
              user_votes: [...(pollData.user_votes || []), optionId],
            },
          };
        }
        return msg;
      }),
    );

    try {
      // Call the atomic database function
      const { data: updatedPollData, error } = await supabase.rpc(
        "update_poll_vote",
        {
          p_message_id: messageId,
          p_option_id: optionId,
          p_user_id: profile.id,
        },
      );

      if (error) {
        // Revert optimistic update on error
        setMessages(originalMessages);

        // Handle specific errors
        if (error.message.includes("expired")) {
          toast.error("This poll has expired");
        } else if (error.message.includes("already voted")) {
          toast.error("You already voted for this option");
        } else {
          throw error;
        }
        return;
      }

      // Update with the actual data from the database
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId && updatedPollData
            ? { ...msg, poll_data: updatedPollData }
            : msg,
        ),
      );

      toast.success("Vote recorded!");
    } catch (error) {
      console.error("Error voting:", error);
      toast.error("Failed to record vote");
      // Revert optimistic update
      setMessages(originalMessages);
    }
  };

  // ============ AUDIO FUNCTIONS ============
  const sendAudioMessage = async (audioBlob: Blob, duration: number) => {
    if (!profile) return;

    // Validate IDs
    if (!chatroom?.id || !profile?.id) {
      toast.error("Missing chatroom or user information");
      return;
    }

    try {
      // Generate waveform
      const waveformData = await generateWaveform(audioBlob);

      // Create a unique filename with proper extension
      const timestamp = Date.now();
      const randomId = crypto.randomUUID();
      const fileName = `audio_${timestamp}_${randomId}.webm`;

      // Use a simpler path structure - avoid using IDs in folder names if they're causing issues
      const filePath = `${chatroom.id}/${profile.id}/${fileName}`;

      console.log("Uploading audio to:", filePath); // Debug log

      // Upload audio file to the chat-attachments bucket
      const { error: uploadError, data } = await supabase.storage
        .from("chat-attachments")
        .upload(filePath, audioBlob, {
          cacheControl: "3600",
          contentType: "audio/webm",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error details:", uploadError);
        throw uploadError;
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("chat-attachments").getPublicUrl(filePath);

      // Prepare audio data
      const audioData: AudioData = {
        url: publicUrl,
        duration,
        waveform_data: waveformData,
        size_bytes: audioBlob.size,
      };

      // Create message with audio
      const { error: insertError } = await supabase.from("messages").insert({
        user_id: profile.id,
        chatroom_id: chatroom.id,
        content: "🎤 Voice message",
        language: profile?.language || "en",
        audio_data: audioData,
      });

      if (insertError) throw insertError;

      toast.success("Voice message sent!");
    } catch (error: any) {
      console.error("Error sending audio:", error);
      toast.error(error.message || "Failed to send voice message");
    }
  };

  // ============ EVENT FUNCTIONS ============
  const shareEventInChat = async (eventId: string) => {
    if (!profile) return;

    try {
      const { data: event, error } = await supabase
        .from("events")
        .select(
          `
        *,
        attendee_count:event_registrations(count)
      `,
        )
        .eq("id", eventId)
        .single();

      if (error) throw error;

      // Check if user is registered
      const { data: registration } = await supabase
        .from("event_registrations")
        .select("status")
        .eq("event_id", eventId)
        .eq("user_id", profile.id)
        .maybeSingle();

      const eventWithStatus = {
        ...event,
        user_registration_status: registration?.status,
      };

      const { error: insertError } = await supabase.from("messages").insert({
        user_id: profile.id,
        chatroom_id: chatroom.id,
        content: `📅 Event: ${event.title}`,
        language: profile?.language || "en",
        event_id: eventId,
      });

      if (insertError) throw insertError;

      // Cache event data
      setEventDataMap((prev) => new Map(prev).set(eventId, eventWithStatus));
      toast.success("Event shared in chat!");
    } catch (error) {
      console.error("Error sharing event:", error);
      toast.error("Failed to share event");
    }
  };

  const setEventReminder = async (eventId: string, remindAt: Date) => {
    if (!profile) return;

    try {
      const { data: message } = await supabase
        .from("messages")
        .select("id")
        .eq("event_id", eventId)
        .eq("chatroom_id", chatroom.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!message) {
        toast.error("Event reference not found");
        return;
      }

      const { error } = await supabase.from("event_reminders").upsert({
        message_id: message.id,
        event_id: eventId,
        user_id: profile.id,
        remind_at: remindAt.toISOString(),
        status: "pending",
      });

      if (error) throw error;

      toast.success(`Reminder set for ${format(remindAt, "MMM d, h:mm a")}`);
    } catch (error) {
      console.error("Error setting reminder:", error);
      toast.error("Failed to set reminder");
    }
  };

  const fetchEventsForMessages = async (messages: MessageRow[]) => {
    const eventMessages = messages.filter(
      (m) => m.event_id && !eventDataMap.has(m.event_id),
    );
    if (eventMessages.length === 0) return;

    const eventIds = [...new Set(eventMessages.map((m) => m.event_id))];

    const { data: events } = await supabase
      .from("events")
      .select(
        `
      *,
      attendee_count:event_registrations(count)
    `,
      )
      .in("id", eventIds);

    if (events) {
      // Fetch registration status for current user
      const { data: registrations } = await supabase
        .from("event_registrations")
        .select("event_id, status")
        .in("event_id", eventIds)
        .eq("user_id", profile?.id || "");

      const regMap = new Map(registrations?.map((r) => [r.event_id, r.status]));

      const newMap = new Map(eventDataMap);
      events.forEach((event) => {
        newMap.set(event.id, {
          ...event,
          user_registration_status: regMap.get(event.id),
        });
      });
      setEventDataMap(newMap);
    }
  };

  // Fetch event data for messages that have event_id
  useEffect(() => {
    if (messages.length > 0 && profile?.id) {
      fetchEventsForMessages(messages);
    }
  }, [messages, profile?.id]);

  const renderMessageContent = (message: MessageRow) => {
    const translated = message.translated_content?.[targetLang];
    const showTranslated = translated && targetLang !== message.language;
    const contentToRender = showTranslated ? translated : message.content;

    // Function to detect and render links, HTML, etc.
    const renderEnhancedContent = (text: string) => {
      if (!text) return null;

      // Split by URLs to handle them specially
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const parts = text.split(urlRegex);

      return parts.map((part, index) => {
        // Check if this part is a URL
        if (urlRegex.test(part)) {
          return (
            <span key={index} className="inline-block">
              {renderLink(part, index)}
            </span>
          );
        }

        // Check for other patterns
        return renderTextWithPatterns(part, index);
      });
    };

    // Function to render a link
    const renderLink = (url: string, key: number) => {
      try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;

        // Get appropriate icon based on domain
        const getLinkIcon = () => {
          if (
            hostname.includes("youtube.com") ||
            hostname.includes("youtu.be")
          ) {
            return <Play className="h-3.5 w-3.5 text-red-500" />;
          }
          if (hostname.includes("instagram.com")) {
            return <ImageIcon className="h-3.5 w-3.5 text-pink-500" />;
          }
          if (hostname.includes("twitter.com") || hostname.includes("x.com")) {
            return <MessageSquare className="h-3.5 w-3.5 text-blue-500" />;
          }
          if (hostname.includes("worldsamma.org")) {
            return <Globe className="h-3.5 w-3.5 text-primary" />;
          }
          if (hostname.includes("blog.") || hostname.includes("medium.com")) {
            return <BookOpen className="h-3.5 w-3.5 text-green-500" />;
          }
          if (hostname.includes("github.com")) {
            return <Code className="h-3.5 w-3.5" />;
          }
          return <Link className="h-3.5 w-3.5 text-muted-foreground" />;
        };

        return (
          <>
            <a
              key={key}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-primary hover:text-primary/80 font-medium underline underline-offset-2 transition-colors group ml-1 mr-1"
            >
              {getLinkIcon()}
              <span className="truncate max-w-[150px] sm:max-w-[200px]">
                {hostname.replace("www.", "")}
              </span>
              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          </>
        );
      } catch (error) {
        return (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary/80 underline underline-offset-2"
          >
            {url}
          </a>
        );
      }
    };

    // Function to render text with patterns
    const renderTextWithPatterns = (text: string, key: number) => {
      if (!text.trim()) return null;

      // Split by various patterns
      const patterns = [
        // Hashtags
        /(#[\w\u4e00-\u9fa5]+)/g,
        // Mentions
        /(@[\w\u4e00-\u9fa5]+)/g,
        // Money amounts
        /(\$\d+(?:\.\d+)?[KM]?(?:\s*\/\s*(?:month|year|week|day))?)/gi,
        // Important numbers
        /(\b\d+[KM]?(?:\s*\/\s*(?:month|year|week|day))?\b)/gi,
      ];

      let parts: React.ReactNode[] = [text];

      patterns.forEach((pattern, patternIndex) => {
        const newParts: React.ReactNode[] = [];
        parts.forEach((part, partIndex) => {
          if (typeof part === "string") {
            const splitParts = part.split(pattern);
            splitParts.forEach((splitPart, splitIndex) => {
              const uniqueKey = `${key}-${patternIndex}-${partIndex}-${splitIndex}`;

              if (pattern.test(splitPart)) {
                // Apply special styling based on pattern
                if (pattern.toString().includes("#")) {
                  newParts.push(
                    <span
                      key={uniqueKey}
                      className="text-primary font-medium hover:text-primary/80 cursor-pointer bg-primary/5 px-1 rounded"
                      onClick={() => {
                        // Navigate to hashtag search
                        router.push(
                          `/search?q=${encodeURIComponent(splitPart)}`,
                        );
                      }}
                    >
                      {splitPart}
                    </span>,
                  );
                } else if (pattern.toString().includes("@")) {
                  newParts.push(
                    <span
                      key={uniqueKey}
                      className="text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer bg-blue-50 dark:bg-blue-900/20 px-1 rounded"
                      onClick={() => {
                        // Search for user
                        console.log("Search mention:", splitPart);
                      }}
                    >
                      {splitPart}
                    </span>,
                  );
                } else if (pattern.toString().includes("\\$")) {
                  newParts.push(
                    <span
                      key={uniqueKey}
                      className="text-green-600 dark:text-green-400 font-semibold bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded"
                    >
                      {splitPart}
                    </span>,
                  );
                } else {
                  // Important numbers
                  newParts.push(
                    <span
                      key={uniqueKey}
                      className="text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-900/20 px-1 rounded"
                    >
                      {splitPart}
                    </span>,
                  );
                }
              } else {
                newParts.push(splitPart);
              }
            });
          } else {
            newParts.push(part);
          }
        });
        parts = newParts;
      });

      return <span key={key}>{parts}</span>;
    };

    return (
      <div className="space-y-3">
        <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
          {renderEnhancedContent(contentToRender)}
        </div>

        {/* Link previews for URLs in the message */}
        {(() => {
          const links = extractLinks(message.content);
          if (links.length > 0) {
            return (
              <div className="mt-3 space-y-2">
                {links.map((link, index) => (
                  <LinkPreview key={index} url={link} />
                ))}
              </div>
            );
          }
          return null;
        })()}

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
              {renderEnhancedContent(message.content)}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Helper function to extract all links from text
  const extractLinks = (text: string): string[] => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex) || [];
    // Deduplicate links
    return [...new Set(matches)];
  };

  const renderReplyPreview = () => {
    if (!replyingTo) return null;

    const replyText = replyingTo.content;
    const shouldTruncate = replyText.length > 100;
    const displayedText = shouldTruncate
      ? `${replyText.substring(0, 100)}...`
      : replyText;

    return (
      <div className="mb-3 p-3 rounded-xl bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-800/30 flex items-center gap-3">
        <Reply className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />

        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="mb-1">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Replying to {replyingTo.user_profile?.full_name || "User"}
              {isPrivateReply && (
                <Badge variant="outline" className="ml-2 text-xs py-0 h-5">
                  <Shield className="h-3 w-3 mr-1" />
                  Private
                </Badge>
              )}
            </span>
          </div>
          <div className="text-sm text-blue-600 dark:text-blue-400">
            <div className="truncate">{displayedText}</div>
          </div>

          {/* Private reply toggle */}
          <div className="mt-2 flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={isPrivateReply}
                onChange={(e) => setIsPrivateReply(e.target.checked)}
                className="h-3 w-3 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-muted-foreground">
                Send as private reply (only visible to you and{" "}
                {replyingTo.user_profile?.full_name || "them"})
              </span>
            </label>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            const currentInput = input;
            const username = replyingTo.user_profile?.full_name || "User";
            const replyPrefix = `@${username} `;

            if (currentInput.startsWith(replyPrefix)) {
              setInput(replyPrefix);
            } else {
              setInput("");
            }
            setReplyingTo(null);
            setIsPrivateReply(false);
          }}
          className="h-7 w-7 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 flex-shrink-0"
          title="Cancel reply"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  const renderReplyIndicator = (message: MessageRow) => {
    if (!message.reply_to || !message.reply_to_message) return null;

    const repliedMessage = message.reply_to_message;
    const isPrivate = message.reply_is_private;

    return (
      <div
        className={cn(
          "mb-2 p-2 rounded-lg border-l-2 cursor-pointer hover:bg-muted transition-colors",
          isPrivate
            ? "bg-purple-50 dark:bg-purple-900/20 border-purple-500 dark:border-purple-400"
            : "bg-muted/50 border-primary",
        )}
        onClick={() => {
          // Scroll to the replied message
          const repliedElement = document.getElementById(
            `message-${repliedMessage.id}`,
          );
          if (repliedElement) {
            repliedElement.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
            repliedElement.classList.add("highlight-pulse");
            setTimeout(() => {
              repliedElement.classList.remove("highlight-pulse");
            }, 2000);
          }
        }}
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <Reply className="h-3 w-3" />
          <span className="font-medium">
            Replying to {repliedMessage.user_profile?.full_name || "User"}
          </span>
          {isPrivate && (
            <Badge
              variant="outline"
              className="ml-1 text-[10px] py-0 px-1.5 h-4"
            >
              <Shield className="h-2.5 w-2.5 mr-0.5" />
              Private
            </Badge>
          )}
        </div>
        <div className="text-sm truncate">
          {repliedMessage.content.length > 50
            ? `${repliedMessage.content.substring(0, 50)}...`
            : repliedMessage.content}
        </div>
      </div>
    );
  };

  // Simplified renderReactions - only one source of truth
  const renderReactions = (message: MessageRow) => {
    const hasReactions =
      message.reactions_count &&
      Object.keys(message.reactions_count).length > 0;

    return (
      <div className="mt-2 flex items-center gap-1 relative">
        {/* Existing reaction buttons */}
        {hasReactions && (
          <div className="flex items-center gap-1 flex-wrap">
            {Object.entries(message.reactions_count ?? {}).map(
              ([emoji, count]) => (
                <Button
                  key={emoji}
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-7 px-2 rounded-full text-xs gap-1",
                    message.user_reactions?.includes(emoji)
                      ? "bg-primary/10 border-primary/30"
                      : "bg-background",
                  )}
                  onClick={() => toggleReaction(message.id, emoji)}
                >
                  <span>{emoji}</span>
                  <span>{count}</span>
                </Button>
              ),
            )}
          </div>
        )}

        {/* Add reaction button - always visible */}
        <Button
          ref={pickerButtonRef}
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full"
          onClick={(e) => {
            e.stopPropagation();
            if (showReactionsPicker === message.id) {
              setShowReactionsPicker(null);
              setPickerState(null);
            } else {
              setShowReactionsPicker(message.id);
              showReactionPicker(message.id, e.currentTarget);
            }
          }}
        >
          <SmilePlus className="h-4 w-4" />
        </Button>

        {/* Portal-based picker - renders at document body level */}
        {pickerState &&
          pickerState.messageId === message.id &&
          createPortal(
            <div
              className="fixed z-[100] animate-in fade-in zoom-in-95 duration-100"
              style={{
                top: pickerState.position.top,
                left: pickerState.position.left,
                transform: "translateX(-50%)",
              }}
            >
              <div className="p-2 bg-card border rounded-xl shadow-xl">
                <div className="flex items-center gap-1 flex-wrap max-w-[200px]">
                  {COMMON_REACTIONS.map((emoji) => (
                    <Button
                      key={emoji}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:scale-110 transition-transform hover:bg-muted"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleReaction(message.id, emoji);
                        setShowReactionsPicker(null);
                        setPickerState(null);
                      }}
                    >
                      <span className="text-lg">{emoji}</span>
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 hover:scale-110 transition-transform"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowReactionsPicker(null);
                      setPickerState(null);
                    }}
                    title="More emojis"
                  >
                    <SmilePlus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Arrow */}
                <div
                  className="absolute w-3 h-3 bg-card border transform rotate-45"
                  style={{
                    top:
                      pickerState.position.top > pickerState.position.top + 100
                        ? "auto"
                        : "-6px",
                    bottom:
                      pickerState.position.top > pickerState.position.top + 100
                        ? "-6px"
                        : "auto",
                    left: "50%",
                    transform: "translateX(-50%) rotate(45deg)",
                    borderTopColor: "transparent",
                    borderLeftColor: "transparent",
                  }}
                />
              </div>
            </div>,
            document.body,
          )}
      </div>
    );
  };

  // Update the message actions dropdown to include Reply option
  const renderMessageActions = (
    message: MessageRow,
    isCurrentUser: boolean,
  ) => (
    <DropdownMenuContent align="end" className="w-48 rounded-xl">
      {message.reply_is_private && (
        <div className="px-2 py-1.5 text-xs text-muted-foreground border-b mb-1">
          <div className="flex items-center gap-1.5">
            <Shield className="h-3 w-3" />
            <span>Private reply</span>
          </div>
        </div>
      )}
      <DropdownMenuItem
        onClick={() => handleReply(message)}
        className="cursor-pointer rounded-lg"
      >
        <Reply className="h-4 w-4 mr-2" />
        Reply
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => {
          router.push(
            `https://www.worldsamma.org/students/${message.user_profile?.admission_no}`,
          );
        }}
        className="cursor-pointer rounded-lg"
      >
        <User className="h-4 w-4 mr-2" />
        View Profile
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => copyMessage(message.content, message.id)}
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
      {isCurrentUser && (
        <>
          <DropdownMenuItem
            onClick={() => startEdit(message.id, message.content)}
            className="cursor-pointer rounded-lg"
          >
            <Edit2 className="h-4 w-4 mr-2" />
            Edit Message
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive cursor-pointer rounded-lg focus:text-destructive"
            onClick={() => removeMessage(message.id)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Message
          </DropdownMenuItem>
        </>
      )}
    </DropdownMenuContent>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-background rounded-xl border shadow-sm overflow-hidden">
      <ReactionNotification
        supabase={supabase}
        profileId={profile?.id!}
        playMessageSound={playReactionSound}
      />
      <PrivateReplyNotification supabase={supabase} profileId={profile?.id!} />
      {/* Header - Fixed & Responsive */}
      <div className="flex-shrink-0 flex items-center justify-between px-2 sm:px-6 py-3 sm:py-4 border-b bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
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
                {chatTitle}
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
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Add Broadcast Composer for WSF user */}
          {profile?.is_wsf && (
            <BroadcastComposer className="hidden sm:inline-flex" />
          )}
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

          {/* Mobile Broadcast Button */}
          {profile?.is_wsf && (
            <div className="sm:hidden">
              <BroadcastComposer />
            </div>
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
              <DropdownMenuItem
                onClick={async () => {
                  toggleSound();
                  const permission = await Notification.requestPermission();
                  if (permission === "granted") {
                    await subscribeToPushNotifications();
                    toast.success("Notifications enabled!");
                  } else {
                    toast.error("Notifications disabled");
                  }
                }}
              >
                {isSoundEnabled ? (
                  <>
                    <Bell className="h-4 w-4 mr-2" />
                    Sound: On
                  </>
                ) : (
                  <>
                    <BellOff className="h-4 w-4 mr-2" />
                    Sound: Off
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => router.push("/")}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Leave Chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Add a "Jump to Shared Message" button when there's a highlighted message */}
      {highlightedMessageId && !hasScrolledToHighlighted && (
        <div className="px-4 py-2 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Linked to a message</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setHasScrolledToHighlighted(true); // Mark as scrolled
                // The useEffect will handle the actual scrolling
              }}
              className="h-7 text-xs"
            >
              Jump to Message
            </Button>
          </div>
        </div>
      )}

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
            <div
              ref={messagesContainerRef}
              className="flex-1 min-h-0 overflow-y-auto scroll-smooth"
            >
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-2 sm:p-8">
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-6">
                    <MessageSquare className="h-10 w-10 text-primary/60" />
                  </div>
                  <h3 className="text-2xl font-semibold mb-3 text-center">
                    Welcome to {chatTitle} 🥋
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
                <div className="p-2 sm:p-6">
                  <div className="max-w-4xl mx-auto space-y-4">
                    {loadingMore && (
                      <div className="py-4 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                        <p className="text-sm text-muted-foreground mt-2">
                          Loading more messages...
                        </p>
                      </div>
                    )}
                    {messages.map((message) => {
                      // Check if this is the highlighted message
                      const isHighlighted = message.id === highlightedMessageId;

                      const beltInfo =
                        message.user_profile?.belt_level !== undefined
                          ? getBeltInfo(message.user_profile.belt_level)
                          : null;

                      const eliteLevel = message.user_profile?.elite_plus
                        ? getElitePlusLevelInfo(
                            message.user_profile.elite_plus_level || 0,
                          )
                        : null;

                      const nextBelt =
                        message.user_profile?.belt_level !== undefined
                          ? getNextBelt(message.user_profile.belt_level)
                          : null;
                      const progressPercentage =
                        message.user_profile?.belt_level !== undefined
                          ? getProgressPercentage(
                              message.user_profile.belt_level,
                            )
                          : 0;

                      const expertiseLevel = getCurrentProgram(
                        message.user_profile?.belt_level || 0,
                      );

                      const isMaxLevel =
                        message.user_profile?.belt_level ===
                        beltOptions.length - 1;

                      const isCurrentUser = message.user_id === profile?.id;
                      const isBroadcast = message.is_broadcast;

                      return (
                        <div
                          key={message.id}
                          ref={isHighlighted ? highlightedMessageRef : null}
                          data-message-id={message.id}
                          data-message-content={message.content}
                          id={`message-${message.id}`}
                          className={cn(
                            "relative group flex flex-col sm:flex-row gap-3 sm:gap-4 p-4 rounded-2xl transition-all duration-200 hover:bg-muted/30 w-full",
                            message.user_id === profile?.id
                              ? "bg-primary/5 border border-primary/10"
                              : "bg-card border border-border/50",
                            isHighlighted && "highlighted-message",
                            isBroadcast &&
                              "bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-purple-200 dark:border-purple-800/30",
                          )}
                        >
                          {/* Broadcast Indicator with Priority */}
                          {message.is_broadcast && (
                            <div className="absolute -top-2 left-4 flex flex-wrap gap-2">
                              {/* Priority Badge */}
                              {message.priority &&
                                message.priority !== "normal" && (
                                  <Badge
                                    className={cn(
                                      "border-0 shadow-lg",
                                      getPriorityBadge(message.priority)
                                        .className,
                                    )}
                                  >
                                    <span className="mr-1">
                                      {getPriorityBadge(message.priority).icon}
                                    </span>
                                    {getPriorityBadge(message.priority).label}
                                  </Badge>
                                )}

                              {/* Scheduled Badge */}
                              {message.scheduled_at &&
                                new Date(message.scheduled_at) > new Date() && (
                                  <Badge
                                    variant="outline"
                                    className="bg-background/80 backdrop-blur-sm"
                                  >
                                    <Clock className="h-3 w-3 mr-1" />
                                    Scheduled
                                  </Badge>
                                )}
                            </div>
                          )}

                          {/* Message content with highlight indicator */}
                          {isHighlighted && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2">
                              <div className="w-3 h-3 rounded-full bg-blue-500 animate-ping" />
                            </div>
                          )}
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
                                      {isMaxLevel && (
                                        <circle
                                          cx="24"
                                          cy="24"
                                          r="18"
                                          stroke={beltInfo.color}
                                          strokeWidth="2"
                                          fill={beltInfo.color}
                                          fillOpacity="0.1"
                                        />
                                      )}
                                    </svg>
                                  </div>
                                )}

                                {/* Avatar */}
                                <Avatar className="h-10 w-10 sm:h-12 sm:w-12 rounded-full border-2 border-background shadow-sm relative z-10">
                                  <AvatarImage
                                    src={message.user_profile?.avatar_url || ""}
                                    className="rounded-full"
                                  />
                                  <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold rounded-xl text-xs">
                                    {getInitials(
                                      message.user_profile?.full_name ?? null,
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
                                (user) => user.id === message.user_profile?.id,
                              ) && (
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border border-background"></div>
                              )}
                            </div>

                            {/* User Info & Timestamp - Full width on mobile */}
                            <div className="flex-1 min-w-0 sm:hidden">
                              <div className="flex flex-col w-full">
                                <div className="flex items-center justify-between w-full mb-1">
                                  <div className="font-semibold text-sm truncate gap-2 flex items-center">
                                    <span>
                                      {isCurrentUser
                                        ? "You"
                                        : message.user_profile?.full_name ||
                                          "Anonymous User"}
                                    </span>
                                    {message.user_profile?.is_wsf && (
                                      <Verified className="h-3 w-3 text-blue-800" />
                                    )}
                                  </div>
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    {formatDistanceToNow(
                                      new Date(message.created_at),
                                      { addSuffix: true },
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

                                    {/* Elite Plus Badge */}
                                    {eliteLevel && (
                                      <Badge
                                        variant="destructive"
                                        className="text-[10px] py-0 px-1.5 font-normal"
                                      >
                                        Elite+ {eliteLevel.name}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Message Content - Full width on all devices */}
                          <div className="flex-1 min-w-0 w-full">
                            {/* Render reply indicator if message is a reply */}
                            {renderReplyIndicator(message)}

                            {/* Desktop User Info - Hidden on mobile */}
                            <div className="hidden sm:flex items-start justify-between mb-2 w-full">
                              <div className="flex flex-col gap-1 flex-1">
                                {/* User Info with Belt Progress */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="flex items-center font-semibold text-sm">
                                    <>
                                      {isCurrentUser
                                        ? "You"
                                        : message.user_profile?.full_name ||
                                          "Anonymous User"}
                                    </>
                                    &nbsp;
                                    {message.user_profile?.is_wsf && (
                                      <Verified className="h-3 w-3 text-blue-800" />
                                    )}
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

                                      {/* Elite Plus Badge */}
                                      {eliteLevel && (
                                        <Badge
                                          variant="destructive"
                                          className="text-[10px] py-0 px-1.5 font-normal"
                                        >
                                          Elite+ {eliteLevel.name}
                                        </Badge>
                                      )}
                                    </>
                                  )}

                                  {/* Show priority dot for all broadcast messages */}
                                  {message.is_broadcast && (
                                    <div
                                      className={cn(
                                        "w-2 h-2 rounded-full",
                                        getPriorityBadge(
                                          message.priority || "normal",
                                        ).color,
                                      )}
                                    />
                                  )}
                                </div>

                                {/* Progress Bar & Next Belt Info */}
                                {beltInfo && (
                                  <div className="flex items-center gap-2 w-full max-w-xs">
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                                        {isMaxLevel ? (
                                          <span className="truncate font-medium text-green-600">
                                            🏆 GM Level Achieved!
                                          </span>
                                        ) : nextBelt ? (
                                          <>
                                            <span className="truncate">
                                              To {nextBelt.name}
                                            </span>
                                            <span>
                                              {Math.round(progressPercentage)}%
                                            </span>
                                          </>
                                        ) : (
                                          <span className="truncate">
                                            Progress
                                          </span>
                                        )}
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

                                    {/* Next Belt Preview or Max Level Badge */}
                                    {isMaxLevel ? (
                                      <div
                                        className="flex items-center gap-1"
                                        title="GM Level"
                                      >
                                        <Crown className="h-3.5 w-3.5 text-yellow-500" />
                                      </div>
                                    ) : nextBelt ? (
                                      <div
                                        className="flex items-center gap-1"
                                        title={`Next: ${nextBelt.name}`}
                                      >
                                        <div
                                          className="w-3 h-3 rounded-full"
                                          style={{
                                            backgroundColor: nextBelt.color,
                                          }}
                                        ></div>
                                      </div>
                                    ) : null}
                                  </div>
                                )}
                              </div>

                              {/* Desktop Timestamp & Actions */}
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {formatDistanceToNow(
                                    new Date(message.created_at),
                                    { addSuffix: true },
                                  )}
                                </span>

                                {/* Desktop Message Actions - Show on hover */}
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-lg"
                                      >
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    {renderMessageActions(
                                      message,
                                      isCurrentUser,
                                    )}
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

                              {/* Poll */}
                              {message.poll_data && (
                                <Poll
                                  pollData={message.poll_data}
                                  messageId={message.id}
                                  onVote={(optionId) =>
                                    voteOnPoll(message.id, optionId)
                                  }
                                  isOwn={isCurrentUser}
                                />
                              )}

                              {/* Audio Message */}
                              {message.audio_data && (
                                <AudioMessage
                                  audioData={message.audio_data}
                                  isOwn={isCurrentUser}
                                />
                              )}

                              {/* Event Reference */}
                              {message.event_id &&
                                eventDataMap.get(message.event_id) && (
                                  <EventReference
                                    event={eventDataMap.get(message.event_id)!}
                                    messageId={message.id}
                                    onRemind={setEventReminder}
                                    onViewEvent={(eventId, slug) => {
                                      router.push(
                                        `https://www.worldsamma.org/students/events/${slug}`,
                                      );
                                    }}
                                    isOwn={isCurrentUser}
                                  />
                                )}

                              {message.file_url &&
                                fileUrls[message.file_url] && (
                                  <div className="mt-3 w-full">
                                    {(() => {
                                      const fileName =
                                        message.file_url.split("/").pop() || "";
                                      const fileExtension =
                                        fileName
                                          .split(".")
                                          .pop()
                                          ?.toLowerCase() || "";
                                      const isImage = [
                                        "jpg",
                                        "jpeg",
                                        "png",
                                        "gif",
                                        "webp",
                                        "svg",
                                      ].includes(fileExtension);
                                      const publicUrl =
                                        fileUrls[message.file_url];

                                      if (isImage) {
                                        // Display image directly
                                        return (
                                          <div className="space-y-2">
                                            <img
                                              src={publicUrl}
                                              alt={fileName}
                                              className="max-w-full rounded-lg max-h-96 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                              onClick={() =>
                                                window.open(publicUrl, "_blank")
                                              }
                                              onError={(e) => {
                                                console.error(
                                                  "Image failed to load:",
                                                  publicUrl,
                                                );
                                                e.currentTarget.style.display =
                                                  "none";
                                              }}
                                            />
                                            <button
                                              onClick={async () => {
                                                try {
                                                  const response =
                                                    await fetch(publicUrl);
                                                  const blob =
                                                    await response.blob();
                                                  const url =
                                                    window.URL.createObjectURL(
                                                      blob,
                                                    );
                                                  const link =
                                                    document.createElement("a");
                                                  link.href = url;
                                                  link.download = fileName;
                                                  document.body.appendChild(
                                                    link,
                                                  );
                                                  link.click();
                                                  document.body.removeChild(
                                                    link,
                                                  );
                                                  window.URL.revokeObjectURL(
                                                    url,
                                                  );
                                                } catch (error) {
                                                  console.error(
                                                    "Download failed:",
                                                    error,
                                                  );
                                                }
                                              }}
                                              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mt-2"
                                            >
                                              <Download className="h-4 w-4" />
                                              Download {fileName}
                                            </button>
                                          </div>
                                        );
                                      }

                                      // For non-images (PDFs, docs, etc.) - show download button
                                      return (
                                        <button
                                          onClick={async () => {
                                            try {
                                              const response =
                                                await fetch(publicUrl);
                                              const blob =
                                                await response.blob();
                                              const url =
                                                window.URL.createObjectURL(
                                                  blob,
                                                );
                                              const link =
                                                document.createElement("a");
                                              link.href = url;
                                              link.download = fileName;
                                              document.body.appendChild(link);
                                              link.click();
                                              document.body.removeChild(link);
                                              window.URL.revokeObjectURL(url);
                                            } catch (error) {
                                              console.error(
                                                "Download failed:",
                                                error,
                                              );
                                            }
                                          }}
                                          className="inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-muted/80 to-muted/50 px-4 py-3 text-sm hover:from-muted hover:to-muted/80 transition-all duration-200 border border-border/50 hover:border-border group w-full"
                                        >
                                          <div className="p-2 rounded-lg bg-background/80 group-hover:bg-background flex-shrink-0">
                                            {fileExtension === "pdf" ? (
                                              <FileText className="h-5 w-5" />
                                            ) : (
                                              <File className="h-5 w-5" />
                                            )}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="font-medium truncate">
                                              {fileName}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                              Click to download
                                            </div>
                                          </div>
                                          <Download className="h-4 w-4 text-muted-foreground group-hover:text-foreground flex-shrink-0" />
                                        </button>
                                      );
                                    })()}
                                  </div>
                                )}

                              {/* Reactions */}
                              <div className="flex items-center gap-2">
                                {renderReactions(message)}
                                {message.view_count > 0 && (
                                  <span className="mt-2 text-xs text-base text-muted-foreground flex items-center gap-1 ml-2">
                                    <Eye className="h-3 w-3" />
                                    {message.view_count}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Mobile Message Actions - Full width row */}
                            <div className="flex items-center justify-between w-full mt-2 sm:hidden">
                              {/* Mobile Progress Bar */}
                              {beltInfo && (
                                <div className="flex items-center gap-2 w-full max-w-xs">
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                                      {isMaxLevel ? (
                                        <span className="truncate font-medium text-green-600">
                                          🏆 Master Level Achieved!
                                        </span>
                                      ) : nextBelt ? (
                                        <>
                                          <span className="truncate">
                                            To {nextBelt.name}
                                          </span>
                                          <span>
                                            {Math.round(progressPercentage)}%
                                          </span>
                                        </>
                                      ) : (
                                        <span className="truncate">
                                          Progress
                                        </span>
                                      )}
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

                                  {/* Next Belt Preview or Max Level Badge */}
                                  {isMaxLevel ? (
                                    <div
                                      className="flex items-center gap-1"
                                      title="Master Level"
                                    >
                                      <Crown className="h-3.5 w-3.5 text-yellow-500" />
                                    </div>
                                  ) : nextBelt ? (
                                    <div
                                      className="flex items-center gap-1"
                                      title={`Next: ${nextBelt.name}`}
                                    >
                                      <div
                                        className="w-3 h-3 rounded-full"
                                        style={{
                                          backgroundColor: nextBelt.color,
                                        }}
                                      ></div>
                                    </div>
                                  ) : null}
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
                                {renderMessageActions(message, isCurrentUser)}
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                    {/* Sentinel div for intersection detection */}
                    <div ref={bottomSentinelRef} className="h-1 w-full" />
                  </div>
                </div>
              )}

              {/* Scroll to Bottom Button */}
              {showScrollButton && messages.length > 0 && (
                <div className="sticky bottom-4 flex justify-center pointer-events-none">
                  <Button
                    onClick={() => scrollToBottom("smooth")}
                    size="sm"
                    className="rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-300"
                    variant="default"
                  >
                    <ChevronDown className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Scroll to bottom</span>
                    <span className="sm:hidden">New messages</span>
                    {messages.filter(
                      (m) =>
                        new Date(m.created_at) > new Date(Date.now() - 60000),
                    ).length > 0 && (
                      <span className="ml-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary-foreground/20 text-[10px] font-medium">
                        {
                          messages.filter(
                            (m) =>
                              new Date(m.created_at) >
                              new Date(Date.now() - 60000),
                          ).length
                        }
                      </span>
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Fixed Message Input Area */}
            <div className="flex-shrink-0 border-t bg-card/50 backdrop-blur-sm p-4">
              <div className="max-w-4xl mx-auto">
                {/* Reply Preview */}
                {renderReplyPreview()}

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
                      {/* Replying indicator */}
                      {replyingTo && (
                        <div className="mb-2 pb-2 border-b flex items-center justify-between text-sm text-muted-foreground">
                          <span>
                            Replying to {replyingTo.user_profile?.full_name}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setReplyingTo(null)}
                            className="h-6 w-6 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}

                      {/* Main input container */}
                      <div className="flex relative gap-1 sm:gap-2 items-end">
                        {/* + Button with popup menu - NO DIALOG */}
                        <div className="relative">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowActionsMenu(!showActionsMenu)}
                            className="h-9 w-9 rounded-full shrink-0 hover:bg-muted"
                            aria-label="More actions"
                          >
                            <Plus className="h-5 w-5" />
                          </Button>

                          {/* Popup menu that appears above the + button */}
                          {showActionsMenu && (
                            <>
                              {/* Backdrop to close menu */}
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setShowActionsMenu(false)}
                              />

                              {/* Menu items */}
                              <div className="absolute bottom-full left-0 mb-2 w-48 bg-popover rounded-lg shadow-lg border overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                                <div className="py-1">
                                  {/* Attach File */}
                                  <button
                                    onClick={() => {
                                      fileInputRef.current?.click();
                                      setShowActionsMenu(false);
                                    }}
                                    disabled={!allowFiles}
                                    className="w-full px-3 py-2.5 text-sm flex items-center gap-3 hover:bg-muted transition-colors disabled:opacity-50"
                                  >
                                    <Paperclip className="h-4 w-4" />
                                    Document
                                  </button>

                                  {/* Poll */}
                                  <button
                                    onClick={() => {
                                      setShowPollCreator(true);
                                      setShowActionsMenu(false);
                                    }}
                                    className="w-full px-3 py-2.5 text-sm flex items-center gap-3 hover:bg-muted transition-colors"
                                  >
                                    <BarChart3 className="h-4 w-4" />
                                    Poll
                                  </button>

                                  {/* Event */}
                                  <button
                                    onClick={() => {
                                      setShowEventPicker(true);
                                      setShowActionsMenu(false);
                                    }}
                                    className="w-full px-3 py-2.5 text-sm flex items-center gap-3 hover:bg-muted transition-colors"
                                  >
                                    <Calendar className="h-4 w-4" />
                                    Event
                                  </button>

                                  {/* Audio/Video Call */}
                                  <button
                                    onClick={() => {
                                      // Handle audio call
                                      setShowActionsMenu(false);
                                    }}
                                    className="w-full px-3 py-2.5 text-sm flex items-center gap-3 hover:bg-muted transition-colors"
                                  >
                                    <Phone className="h-4 w-4" />
                                    Audio Call
                                  </button>

                                  <button
                                    onClick={() => {
                                      // Handle video call
                                      setShowActionsMenu(false);
                                    }}
                                    className="w-full px-3 py-2.5 text-sm flex items-center gap-3 hover:bg-muted transition-colors"
                                  >
                                    <Video className="h-4 w-4" />
                                    Video Call
                                  </button>

                                  <div className="h-px bg-border my-1" />

                                  {/* Contact */}
                                  <button
                                    onClick={() => {
                                      // Handle share contact
                                      setShowActionsMenu(false);
                                    }}
                                    className="w-full px-3 py-2.5 text-sm flex items-center gap-3 hover:bg-muted transition-colors"
                                  >
                                    <UserPlus className="h-4 w-4" />
                                    Contact
                                  </button>

                                  {/* Location */}
                                  <button
                                    onClick={() => {
                                      // Handle location
                                      setShowActionsMenu(false);
                                    }}
                                    className="w-full px-3 py-2.5 text-sm flex items-center gap-3 hover:bg-muted transition-colors"
                                  >
                                    <MapPin className="h-4 w-4" />
                                    Location
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Text input */}
                        <div className="relative flex-1">
                          <EmojiPickerComponent
                            onEmojiSelect={handleEmojiSelect}
                            disabled={sending}
                          />

                          <Textarea
                            ref={textareaRef}
                            placeholder={
                              replyingTo
                                ? `Replying to ${replyingTo.user_profile?.full_name}...`
                                : "Type a message..."
                            }
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyPress}
                            disabled={sending}
                            className="text-sm min-h-[40px] max-h-[120px] resize-none rounded-2xl border-0 bg-muted px-4 py-2.5 pl-8 focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 hide-scrollbar"
                            rows={1}
                          />
                        </div>

                        {/* Right button - Toggles between mic and send based on input */}
                        <div className="absolute right-0.5 bottom-1.5">
                          {!input.trim() && !file ? (
                            /* Voice Recording Button (when no text) */
                            <AudioRecorder
                              onSend={sendAudioMessage}
                              disabled={sending}
                            />
                          ) : (
                            /* Send Button (when text exists) */
                            <Button
                              type="button"
                              size="icon"
                              onClick={sendMessage}
                              disabled={(!input.trim() && !file) || sending}
                              className="h-7 w-7 rounded-full bg-primary hover:bg-primary/90 shrink-0"
                            >
                              {sending ? (
                                <Loader2 className="h-3.5 w-3.5 text-primary-foreground animate-spin" />
                              ) : (
                                <Send className="h-3.5 w-3.5 text-primary-foreground" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom status bar */}
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
                    </div>
                  </div>
                </div>

                {/* Hidden file input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
                  multiple
                />

                {/* Poll Creator Dialog */}
                <PollCreator
                  open={showPollCreator}
                  onOpenChange={setShowPollCreator}
                  onCreate={createPoll}
                />

                {/* Event Picker Dialog */}
                <Dialog
                  open={showEventPicker}
                  onOpenChange={setShowEventPicker}
                >
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Share an Event</DialogTitle>
                      <DialogDescription>
                        Select an event to share with the chatroom
                      </DialogDescription>
                    </DialogHeader>

                    <EventPicker
                      onSelect={async (eventId) => {
                        await shareEventInChat(eventId);
                        setShowEventPicker(false);
                      }}
                    />
                  </DialogContent>
                </Dialog>

                {/* Audio Recorder - now fully integrated as the mic button */}
                {/* The AudioRecorder component should render as just a button that opens recording UI */}
              </div>
              <div></div>
            </div>
          </TabsContent>

          <TabsContent
            value="info"
            className="min-h-0 overflow-auto p-2 sm:p-6 h-full overflow-y-auto mt-0"
          >
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Chatroom Information */}
              <div>
                <h3 className="text-lg font-semibold mb-3">
                  Chatroom Information
                </h3>
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

              {/* Weekly Rewards Section */}
              <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 p-2 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm sm:text-lg font-semibold flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-yellow-600" />
                      Weekly Activity Rewards
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Top contributors receive special rewards every Sunday!
                    </p>
                  </div>
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Calendar className="h-3 w-3" />
                    Resets: Sunday 12:00 AM UTC
                  </Badge>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {/* Reward Tiers */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Reward Tiers 🏆</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center">
                            <span className="text-yellow-700 font-bold text-sm">
                              1
                            </span>
                          </div>
                          <div>
                            <div className="font-medium">Gold Tier</div>
                            <div className="text-xs text-muted-foreground">
                              Top 1-3
                            </div>
                          </div>
                        </div>
                        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                          500 WSF Points
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                            <span className="text-slate-700 font-bold text-sm">
                              2
                            </span>
                          </div>
                          <div>
                            <div className="font-medium">Silver Tier</div>
                            <div className="text-xs text-muted-foreground">
                              Top 4-7
                            </div>
                          </div>
                        </div>
                        <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-100">
                          250 WSF Points
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                            <span className="text-amber-700 font-bold text-sm">
                              3
                            </span>
                          </div>
                          <div>
                            <div className="font-medium">Bronze Tier</div>
                            <div className="text-xs text-muted-foreground">
                              Top 8-10
                            </div>
                          </div>
                        </div>
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                          100 WSF Points
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Current Week Stats */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">
                      This Week's Progress
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            {profile?.avatar_url ? (
                              <img
                                src={profile.avatar_url}
                                className="h-8 w-8 rounded-full"
                              />
                            ) : (
                              <User className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium">Your Rank</div>
                            <div className="text-xs text-muted-foreground">
                              {userRank
                                ? `#${userRank.position} with ${userRank.messageCount} messages`
                                : "Not ranked yet"}
                            </div>
                          </div>
                        </div>
                        {userRank && userRank?.position! <= 10 && (
                          <Badge variant="secondary" className="gap-1">
                            <TrendingUp className="h-3 w-3" />
                            Top 10
                          </Badge>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2 mb-1">
                          <Info className="h-3 w-3" />
                          <span className="font-medium">How it works:</span>
                        </div>
                        <ul className="space-y-1 pl-5 list-disc">
                          <li>Every message counts as 1 point</li>
                          <li>Top 10 each week get rewards</li>
                          <li>Leaderboards reset every Sunday</li>
                          <li>Rewards are distributed automatically</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Leaderboards - 3 columns on desktop */}
              <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
                {/* 24-Hour Leaderboard */}
                <div className="rounded-lg border">
                  <div className="p-4 border-b">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Zap className="h-4 w-4 text-green-600" />
                        Last 24 Hours
                      </h4>
                      <Badge variant="outline" className="text-xs">
                        Live
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Today's most active
                    </p>
                  </div>

                  <div className="p-2">
                    {loadingLeaderboards ? (
                      <div className="p-6 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Loading...
                        </p>
                      </div>
                    ) : dailyLeaderboard.length === 0 ? (
                      <div className="p-6 text-center">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          No messages today
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {dailyLeaderboard.slice(0, 5).map((item, index) => (
                          <LeaderboardItem
                            key={item.user.id}
                            item={item}
                            index={index}
                            currentUserId={profile?.id}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Weekly Leaderboard */}
                <div className="rounded-lg border">
                  <div className="p-4 border-b">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-blue-600" />
                        This Week
                      </h4>
                      <Badge variant="outline" className="text-xs">
                        For Rewards
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Weekly ranking for rewards
                    </p>
                  </div>

                  <div className="p-2">
                    {loadingLeaderboards ? (
                      <div className="p-6 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Loading...
                        </p>
                      </div>
                    ) : weeklyLeaderboard.length === 0 ? (
                      <div className="p-6 text-center">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          No messages this week
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {weeklyLeaderboard.slice(0, 5).map((item, index) => (
                          <LeaderboardItem
                            key={item.user.id}
                            item={item}
                            index={index}
                            currentUserId={profile?.id}
                            showRewardTier={true}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* All-Time Leaderboard */}
                <div className="rounded-lg border">
                  <div className="p-4 border-b">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Award className="h-4 w-4 text-purple-600" />
                        All-Time Top 5
                      </h4>
                      <Badge variant="outline" className="text-xs">
                        Legends
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Most active members overall
                    </p>
                  </div>

                  <div className="p-2">
                    {loadingLeaderboards ? (
                      <div className="p-6 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Loading...
                        </p>
                      </div>
                    ) : allTimeLeaderboard.length === 0 ? (
                      <div className="p-6 text-center">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          No messages yet
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {allTimeLeaderboard.slice(0, 5).map((item, index) => (
                          <LeaderboardItem
                            key={item.user.id}
                            item={item}
                            index={index}
                            currentUserId={profile?.id}
                            isAllTime={true}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Enhanced Online Users Tab */}
          <TabsContent
            value="members"
            className="min-h-0 overflow-auto p-2 sm:p-6 h-full overflow-y-auto mt-0"
          >
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Header with stats */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">Members</h3>
                  <p className="text-sm text-muted-foreground">
                    Connect with fellow WSF members
                  </p>
                </div>
                <div className="flex items-center justify-evenly gap-2 sm:gap-4 w-full">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {onlineCount}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Online Now
                    </div>
                  </div>
                  <Separator orientation="vertical" className="h-8" />
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {onlineUsers.length}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Total Members
                    </div>
                  </div>
                </div>
              </div>

              {/* Filter tabs */}
              <Tabs defaultValue="online" className="w-full">
                <TabsList className="grid grid-cols-3 w-full max-w-xs">
                  <TabsTrigger value="online" className="gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    Online
                  </TabsTrigger>
                  <TabsTrigger value="all" className="gap-2">
                    <Users className="h-4 w-4" />
                    All
                  </TabsTrigger>
                  <TabsTrigger value="elite" className="gap-2">
                    <Crown className="h-4 w-4" />
                    Elite+
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="online" className="mt-4">
                  {onlineUsers.filter((user) => user.status === "online")
                    .length === 0 ? (
                    <div className="text-center py-12 border rounded-xl bg-gradient-to-br from-muted/20 to-muted/10">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                        <Users className="h-8 w-8 text-primary/60" />
                      </div>
                      <h4 className="font-semibold mb-2">No members online</h4>
                      <p className="text-muted-foreground text-sm max-w-md mx-auto">
                        Be the first to start chatting! Members who join will
                        appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {onlineUsers
                        .filter((user) => user.status === "online")
                        .sort((a, b) => {
                          // Sort by elite+ first, then belt level
                          if (a.elite_plus && !b.elite_plus) return -1;
                          if (!a.elite_plus && b.elite_plus) return 1;
                          return (b.belt_level || 0) - (a.belt_level || 0);
                        })
                        .map((user) => renderUserCard(user, true))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="all" className="mt-4">
                  {onlineUsers.length === 0 ? (
                    <div className="text-center py-12 border rounded-xl">
                      <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        No members in this chatroom
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {onlineUsers
                        .sort((a, b) => {
                          // Sort by status (online first), then elite+, then belt level
                          if (a.status === "online" && b.status !== "online")
                            return -1;
                          if (a.status !== "online" && b.status === "online")
                            return 1;
                          if (a.elite_plus && !b.elite_plus) return -1;
                          if (!a.elite_plus && b.elite_plus) return 1;
                          return (b.belt_level || 0) - (a.belt_level || 0);
                        })
                        .map((user) =>
                          renderUserCard(user, user.status === "online"),
                        )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="elite" className="mt-4">
                  {onlineUsers.filter((user) => user.elite_plus).length ===
                  0 ? (
                    <div className="text-center py-12 border rounded-xl bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 flex items-center justify-center mx-auto mb-4">
                        <Crown className="h-8 w-8 text-yellow-600 dark:text-yellow-500" />
                      </div>
                      <h4 className="font-semibold mb-2">No Elite+ members</h4>
                      <p className="text-muted-foreground text-sm max-w-md mx-auto">
                        Elite+ members are certified instructors and senior
                        practitioners. They'll appear here when they join.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {onlineUsers
                        .filter((user) => user.elite_plus)
                        .sort((a, b) => {
                          // Sort by elite level, then belt level
                          const aLevel = a.elite_plus_level || 0;
                          const bLevel = b.elite_plus_level || 0;
                          if (bLevel !== aLevel) return bLevel - aLevel;
                          return (b.belt_level || 0) - (a.belt_level || 0);
                        })
                        .map((user) =>
                          renderUserCard(user, user.status === "online"),
                        )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              {/* Statistics Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                <div className="rounded-xl border p-4 bg-gradient-to-br from-primary/5 to-primary/10">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">Belt Distribution</h4>
                    <Trophy className="h-4 w-4 text-primary" />
                  </div>
                  <div className="space-y-2">
                    {["Beginner", "Intermediate", "Advanced", "Elite"].map(
                      (level, idx) => {
                        const count = onlineUsers.filter((user) => {
                          const belt = getBeltInfo(user.belt_level || 0);
                          const program = getCurrentProgram(
                            user.belt_level || 0,
                          );
                          return program.title === level;
                        }).length;

                        const percentage =
                          onlineUsers.length > 0
                            ? Math.round((count / onlineUsers.length) * 100)
                            : 0;

                        return (
                          <div
                            key={level}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-muted-foreground">
                              {level}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{count}</span>
                              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>

                <div className="rounded-xl border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">Elite+ Members</h4>
                    <Crown className="h-4 w-4 text-yellow-600" />
                  </div>
                  <div className="text-center py-4">
                    <div className="text-3xl font-bold text-yellow-600 mb-1">
                      {onlineUsers.filter((u) => u.elite_plus).length}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Certified Instructors
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">Average Belt Level</h4>
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="text-center py-4">
                    <div className="text-3xl font-bold mb-1">
                      {onlineUsers.length > 0
                        ? Math.round(
                            onlineUsers.reduce(
                              (acc, user) => acc + (user.belt_level || 0),
                              0,
                            ) / onlineUsers.length,
                          )
                        : 0}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Average belt rank
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function renderUserCard(user: PresenceUser, isOnline: boolean) {
  const beltInfo = getBeltInfo(user.belt_level || 0);
  const eliteLevel = user.elite_plus
    ? getElitePlusLevelInfo(user.elite_plus_level || 0)
    : null;
  const program = getCurrentProgram(user.belt_level || 0);
  const nextBelt = getNextBelt(user.belt_level || 0);
  const progressPercentage = getProgressPercentage(user.belt_level || 0);
  const isMaxLevel = user.belt_level === beltOptions.length - 1;

  return (
    <div
      key={user.id}
      className="flex items-center gap-2 sm:gap-4 p-3 sm:p-4 rounded-lg sm:rounded-xl border hover:bg-muted/30 transition-all duration-200 group"
    >
      {/* Avatar section - simpler on mobile */}
      <div className="relative flex-shrink-0">
        <div className="relative">
          {/* Progress ring - hidden on mobile */}
          <div className="hidden sm:block absolute -inset-1">
            <svg className="w-14 h-14 transform -rotate-90">
              <circle
                cx="28"
                cy="28"
                r="24"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                className="text-muted-foreground/20"
              />
              <circle
                cx="28"
                cy="28"
                r="24"
                stroke={beltInfo.color}
                strokeWidth="2"
                fill="none"
                strokeDasharray={`${progressPercentage * 1.5} 150`}
                className="transition-all duration-500"
              />
            </svg>
          </div>

          <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-background relative z-10">
            <AvatarImage src={user.avatar_url || ""} />
            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-xs sm:text-sm">
              {getInitials(user.full_name)}
            </AvatarFallback>
          </Avatar>

          {/* Elite+ crown - smaller on mobile */}
          {user.elite_plus && (
            <div className="absolute -top-1 -right-1">
              <div className="h-4 w-4 sm:h-6 sm:w-6 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center border border-background shadow-sm sm:shadow-lg">
                <Crown className="h-2 w-2 sm:h-3 sm:w-3 text-white" />
              </div>
            </div>
          )}

          {/* Online status */}
          <div
            className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 sm:h-3 sm:w-3 rounded-full border border-background ${
              isOnline ? "bg-green-500" : "bg-gray-400"
            }`}
          />
        </div>
      </div>

      {/* User info - responsive layout */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-2 mb-2">
          {/* Left side - Name and badges */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 sm:gap-2 mb-1">
              <p className="font-semibold text-sm sm:text-base truncate">
                {user.full_name || "Anonymous"}
              </p>
              {/* Admission no - only on larger screens */}
              {user.admission_no && (
                <Badge
                  variant="outline"
                  className="text-[10px] font-normal px-1.5"
                >
                  {user.admission_no}
                </Badge>
              )}
            </div>

            {/* Badges - responsive layout */}
            <div className="flex items-center gap-1 flex-wrap">
              {/* Belt badge - simplified text on mobile */}
              <Badge
                className="text-[10px] sm:text-xs py-0.5 px-1.5 sm:px-2 border rounded-full truncate max-w-[80px] sm:max-w-none !bg-transparent"
                style={{
                  backgroundColor:
                    beltInfo.level === 0
                      ? "rgba(0, 0, 0, 0.1) !important" // Light gray for white belt
                      : `${beltInfo.color}20 !important`,
                  borderColor:
                    beltInfo.level === 0
                      ? "rgba(0, 0, 0, 0.2) !important"
                      : `${beltInfo.color}40 !important`,
                  color: beltInfo.level === 0 ? "black !important" : "inherit",
                }}
              >
                <span className="hidden xs:inline">{beltInfo.name}</span>
                <span className="xs:hidden">{beltInfo.name.split(" ")[0]}</span>
              </Badge>

              {/* Program badge - hidden on very small screens */}
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                {program.title.split(" ")[0]}
              </Badge>

              {/* Elite+ badge - simplified on mobile */}
              {eliteLevel && (
                <Badge
                  variant="destructive"
                  className="text-[10px] py-0 px-1.5 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-400/30 truncate max-w-[70px]"
                >
                  <span className="hidden sm:inline">
                    Elite+ {eliteLevel.name}
                  </span>
                  <span className="sm:hidden">
                    E+ {eliteLevel.name.charAt(0)}
                  </span>
                </Badge>
              )}
            </div>
          </div>

          {/* Right side - Status and country */}
          <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-0 sm:flex-col sm:items-end sm:text-right">
            <div className="text-xs text-muted-foreground">
              {isOnline ? (
                <span className="flex items-center gap-1 text-green-600">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="hidden sm:inline">Online</span>
                  <span className="sm:hidden">Live</span>
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span className="hidden sm:inline">
                    {formatDistanceToNow(new Date(user.last_seen))} ago
                  </span>
                  <span className="sm:hidden text-[10px]">
                    {formatDistanceToNowShort(new Date(user.last_seen))}
                  </span>
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Globe className="h-3 w-3 flex-shrink-0" />
              <span className="truncate max-w-[60px] sm:max-w-none">
                {user.country_code?.toUpperCase() || "Unknown"}
              </span>
            </div>
          </div>
        </div>

        {/* Progress bar - simplified on mobile */}
        {!isMaxLevel && nextBelt && (
          <div className="space-y-1 mt-1 sm:mt-0">
            <div className="flex items-center justify-between text-[10px] sm:text-xs">
              <span className="text-muted-foreground truncate max-w-[100px] sm:max-w-none">
                <span className="hidden sm:inline">
                  Progress to {nextBelt.name}
                </span>
                <span className="sm:hidden">
                  To {nextBelt.name.split(" ")[0]}
                </span>
              </span>
              <span className="font-medium flex-shrink-0">
                {Math.round(progressPercentage)}%
              </span>
            </div>
            <div className="h-1 sm:h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progressPercentage}%`,
                  backgroundColor: beltInfo.color,
                }}
              />
            </div>
          </div>
        )}

        {/* Max level indicator - simplified */}
        {isMaxLevel && (
          <div className="flex items-center gap-1 sm:gap-2 mt-1">
            <div className="flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded-full bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20">
              <Crown className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-yellow-600" />
              <span className="text-[10px] sm:text-xs font-medium truncate">
                <span className="hidden sm:inline">Grand Master Level</span>
                <span className="sm:hidden">GM Level</span>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Add this helper function
function formatDistanceToNowShort(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) {
    return `${diffMins}m`;
  } else if (diffHours < 24) {
    return `${diffHours}h`;
  } else {
    return `${diffDays}d`;
  }
}
