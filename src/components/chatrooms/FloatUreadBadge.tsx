// components/chatrooms/FloatingUnreadBadge.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Bell, BellRing, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { useTotalUnreadCount } from "@/lib/hooks/useUnreadMessages";
import { UnreadMessagesDialog } from "./UnreadMessagesDialog";

interface FloatingUnreadBadgeProps {
  onDismiss?: () => void;
}

export function FloatingUnreadBadge({ onDismiss }: FloatingUnreadBadgeProps) {
  const router = useRouter();
  const { unreadCount, refreshUnreadCount } = useTotalUnreadCount();
  const [isVisible, setIsVisible] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Refresh count periodically while visible
  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      refreshUnreadCount();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [isVisible, refreshUnreadCount]);

  // Don't show if no unread messages or user dismissed
  if (unreadCount === 0 || !isVisible) {
    return null;
  }

  const handleClick = () => {
    setDialogOpen(true);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsVisible(false);
    if (onDismiss) onDismiss();
  };

  // Format count display
  const displayCount = unreadCount > 99 ? "99+" : unreadCount;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ scale: 0, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0, opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="fixed bottom-6 right-4 z-50 md:bottom-8 md:right-8"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <Button
            onClick={handleClick}
            className="relative h-14 w-14 rounded-full shadow-lg transition-all duration-300 group"
            style={{
              background:
                "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary)/0.8))",
              boxShadow: isHovered
                ? "0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 0 0 2px hsl(var(--primary)/0.3)"
                : "0 4px 14px -1px rgba(0, 0, 0, 0.2)",
            }}
          >
            {/* Animated bell icon */}
            <div className="relative">
              {unreadCount > 0 && (
                <motion.div
                  animate={{ rotate: [0, 15, -15, 10, -10, 0] }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                >
                  <BellRing className="h-6 w-6 text-white" />
                </motion.div>
              )}
              {unreadCount === 0 && <Bell className="h-6 w-6 text-white/70" />}
            </div>

            {/* Unread count badge */}
            <Badge className="absolute -top-2 -right-2 h-6 min-w-[24px] px-1.5 bg-red-500 hover:bg-red-600 text-white border-2 border-background font-bold animate-pulse">
              {displayCount}
            </Badge>

            {/* Pulsing ring effect */}
            <div
              className="absolute inset-0 rounded-full animate-ping opacity-20 bg-white"
              style={{ animationDuration: "1.5s" }}
            />
          </Button>

          {/* Dismiss button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute -top-3 -left-3 h-6 w-6 rounded-full bg-background border shadow-sm hover:bg-muted p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleDismiss}
          >
            <X className="h-3 w-3" />
          </Button>

          {/* Tooltip on hover */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap bg-popover text-popover-foreground px-3 py-1.5 rounded-lg text-sm shadow-md border"
              >
                <div className="flex items-center gap-2">
                  <Inbox className="h-3 w-3" />
                  {unreadCount} unread message{unreadCount !== 1 ? "s" : ""}
                </div>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 rotate-45 w-2 h-2 bg-popover border-r border-t" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>

      {/* Unread Messages Dialog */}
      <UnreadMessagesDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onChatroomClick={(chatroomId) => {
          router.push(`/chatrooms/${chatroomId}`);
        }}
      />
    </>
  );
}
