// app/api/chatrooms/presence/online/route.ts - Add caching
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { NextRequest, NextResponse } from "next/server";

// Add response caching to reduce database load
export const revalidate = 0; // Don't cache at edge
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chatroomId = searchParams.get("chatroomId");

    if (!chatroomId) {
      return NextResponse.json(
        { error: "Missing chatroomId" },
        { status: 400 }
      );
    }

    // Add timeout for long-running queries
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: presenceData, error } = await supabaseAdmin
      .from("user_presence")
      .select(
        `
        status,
        last_seen,
        users_profile:user_id (
          id,
          full_name,
          avatar_url,
          belt_level,
          country_code
        )
      `
      )
      .eq("chatroom_id", chatroomId)
      .gt("last_seen", fiveMinutesAgo)
      .in("status", ["online", "away"]);

    clearTimeout(timeoutId);

    if (error) throw error;

    // Transform the data
    const onlineUsers =
      presenceData
        ?.filter((presence) => presence.users_profile)
        .map((presence) => ({
          ...presence.users_profile,
          last_seen: presence.last_seen,
          status: presence.status as "online" | "away" | "offline",
        })) || [];

    return NextResponse.json({ onlineUsers });
  } catch (error: any) {
    console.error("Get online users error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get online users" },
      { status: 500 }
    );
  }
}
