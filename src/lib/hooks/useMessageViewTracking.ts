// hooks/useMessageViewTracking.ts
import { useRef, useCallback } from "react";
import { useAuth } from "@/lib/context/AuthContext";

export function useMessageViewTracking() {
  const { supabase, profile } = useAuth();
  const startTimes = useRef<Map<string, number>>(new Map());
  const recordedViews = useRef<Set<string>>(new Set());
  const observers = useRef<Map<string, IntersectionObserver>>(new Map());

  const getMinDuration = useCallback((content: string) => {
    let duration = 2;
    const length = content.length;

    if (length > 100) {
      duration += Math.min(8, Math.floor(length / 200));
    }

    if (
      content.includes(".jpg") ||
      content.includes(".png") ||
      content.includes(".gif") ||
      content.includes(".mp4")
    ) {
      duration += 3;
    }

    if (
      content.toLowerCase().includes("poll") ||
      content.toLowerCase().includes("event")
    ) {
      duration += 5;
    }

    return duration;
  }, []);

  const recordView = useCallback(
    async (messageId: string, duration: number, content: string) => {
      if (!supabase || recordedViews.current.has(messageId)) return;

      const minDuration = getMinDuration(content);
      if (duration < minDuration) return;

      recordedViews.current.add(messageId);

      try {
        await supabase.rpc("increment_message_view", {
          p_message_id: messageId,
          p_user_id: profile?.id || null,
          p_duration: Math.floor(duration),
          p_session_id: profile?.id ? null : crypto.randomUUID(),
        });
      } catch (error) {
        console.error("Error recording view:", error);
      }
    },
    [supabase, profile?.id, getMinDuration],
  );

  const setupTracking = useCallback(() => {
    const messageElements = document.querySelectorAll("[data-message-id]");

    messageElements.forEach((element) => {
      const messageId = element.getAttribute("data-message-id");
      const content = element.getAttribute("data-message-content") || "";

      if (!messageId || observers.current.has(messageId)) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const id = entry.target.getAttribute("data-message-id");
            if (!id) return;

            if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
              if (!startTimes.current.has(id)) {
                startTimes.current.set(id, Date.now());
              }
            } else if (startTimes.current.has(id)) {
              const duration =
                (Date.now() - startTimes.current.get(id)!) / 1000;
              recordView(id, duration, content);
              startTimes.current.delete(id);
            }
          });
        },
        { threshold: 0.5 },
      );

      observer.observe(element);
      observers.current.set(messageId, observer);
    });
  }, [recordView]);

  // Cleanup function
  const cleanup = useCallback(() => {
    // Record any remaining views
    for (const [messageId, startTime] of startTimes.current.entries()) {
      const element = document.querySelector(
        `[data-message-id="${messageId}"]`,
      );
      const content = element?.getAttribute("data-message-content") || "";
      const duration = (Date.now() - startTime) / 1000;
      recordView(messageId, duration, content);
    }

    // Disconnect all observers
    observers.current.forEach((observer) => observer.disconnect());
    observers.current.clear();
    startTimes.current.clear();
  }, [recordView]);

  return { setupTracking, cleanup };
}
