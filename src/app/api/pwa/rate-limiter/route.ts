// app/api/broadcast/rate-limit/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Simple in-memory rate limiting (use Redis in production)
const broadcastLimits = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { chatroomId } = await request.json();
  const key = `${user.id}:${chatroomId}`;
  const now = Date.now();
  const limit = {
    maxBroadcasts: 5, // Max 5 broadcasts per day
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
  };

  const record = broadcastLimits.get(key);

  if (record && record.resetAt > now) {
    if (record.count >= limit.maxBroadcasts) {
      return NextResponse.json({
        allowed: false,
        remaining: 0,
        resetAt: record.resetAt,
      });
    }

    record.count++;
    broadcastLimits.set(key, record);

    return NextResponse.json({
      allowed: true,
      remaining: limit.maxBroadcasts - record.count,
      resetAt: record.resetAt,
    });
  }

  // New rate limit window
  broadcastLimits.set(key, {
    count: 1,
    resetAt: now + limit.windowMs,
  });

  return NextResponse.json({
    allowed: true,
    remaining: limit.maxBroadcasts - 1,
    resetAt: now + limit.windowMs,
  });
}
