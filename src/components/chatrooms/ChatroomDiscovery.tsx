"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { chatrooms, visibilityCopy } from "@/lib/chatrooms/config";
import { checkEligibility } from "@/lib/chatrooms/eligibility";
import { ChatroomDefinition, ChatroomType, EligibilityStatus } from "@/lib/chatrooms/types";
import { useAuth } from "@/lib/context/AuthContext";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type StatusMap = Record<ChatroomType, EligibilityStatus>;

export function ChatroomDiscovery() {
  const { supabase, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [statuses, setStatuses] = useState<StatusMap>(() =>
    chatrooms.reduce((acc, room) => {
      acc[room.id] = { state: "loading" };
      return acc;
    }, {} as StatusMap)
  );

  const [joining, setJoining] = useState<Record<ChatroomType, boolean>>(
    () => chatrooms.reduce((acc, room) => ({ ...acc, [room.id]: false }), {} as Record<ChatroomType, boolean>)
  );
  const [isPending, startTransition] = useTransition();

  const loading = authLoading || Object.values(statuses).some((s) => s.state === "loading");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const entries = await Promise.all(
        chatrooms.map(async (room) => {
          const status = await checkEligibility(
            supabase,
            profile,
            room.id,
            profile?.country_code ?? null
          );
          return [room.id, status] as const;
        })
      );

      if (!cancelled) {
        setStatuses((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [profile, supabase]);

  const sortedRooms = useMemo<ChatroomDefinition[]>(() => chatrooms, []);

  const handleJoin = (roomId: ChatroomType) => {
    setJoining((prev) => ({ ...prev, [roomId]: true }));
    startTransition(async () => {
      try {
        const res = await fetch("/api/chatrooms/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatroomId: roomId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to join chatroom");
        }
        const data = await res.json();
        toast.success("Joined chatroom");
        router.push(`/chatrooms/${data.chatroom_id}`);
      } catch (err) {
        console.error(err);
        toast.error((err as Error).message);
      } finally {
        setJoining((prev) => ({ ...prev, [roomId]: false }));
      }
    });
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-2 sm:px-6 py-12">
      <header className="space-y-3">
        <p className="text-sm font-medium text-primary">WSF Chatrooms</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Chatroom discovery & eligibility
        </h1>
        <p className="max-w-3xl text-muted-foreground">
          All chatrooms are listed here. Selecting a room will show the
          eligibility rules. Auth is handled via the shared Supabase context
          across subdomains.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {sortedRooms.map((room) => {
          const status = statuses[room.id] ?? { state: "loading" };
          return (
            <Card key={room.id} className="flex flex-col gap-3">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {room.visibility === "public" ? "Open" : "Restricted"}
                    </p>
                    <CardTitle>{room.title}</CardTitle>
                    <CardDescription>{room.access}</CardDescription>
                  </div>
                  <Badge variant="outline">{visibilityCopy[room.visibility]}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {room.notes ? (
                  <p className="text-xs text-muted-foreground">{room.notes}</p>
                ) : null}
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-foreground">Features</p>
                  <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                    {room.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">
                    {status.state === "ineligible"
                      ? status.reason
                      : status.state === "eligible"
                        ? "Eligible to join"
                        : "Checking eligibility..."}
                  </span>
                  <Button
                    size="sm"
                    disabled={status.state !== "eligible" || joining[room.id] || isPending}
                    onClick={() => handleJoin(room.id)}
                  >
                    {joining[room.id] ? "Joining..." : status.state === "eligible" ? "View & join" : "Restricted"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </main>
  );
}

