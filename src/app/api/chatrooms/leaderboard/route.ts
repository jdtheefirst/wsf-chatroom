// app/api/chatrooms/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const revalidate = 10;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chatroomId = searchParams.get("chatroomId");

    if (!chatroomId) {
      return NextResponse.json(
        { error: "Missing chatroomId" },
        { status: 400 },
      );
    }

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Use the database function for efficient aggregation
    const [daily, weekly, allTime] = await Promise.all([
      supabaseAdmin.rpc("get_chatroom_leaderboard", {
        p_chatroom_id: chatroomId,
        p_start_date: yesterday.toISOString(),
        p_limit: 10,
      }),
      supabaseAdmin.rpc("get_chatroom_leaderboard", {
        p_chatroom_id: chatroomId,
        p_start_date: weekStart.toISOString(),
        p_limit: 10,
      }),
      supabaseAdmin.rpc("get_chatroom_leaderboard", {
        p_chatroom_id: chatroomId,
        p_start_date: ninetyDaysAgo.toISOString(),
        p_limit: 10,
      }),
    ]);

    // Format the response
    const formatLeaderboard = (data: any) => {
      if (data.error) throw data.error;
      return (data.data || []).map((item: any) => ({
        user: {
          id: item.user_id,
          full_name: item.full_name,
          admission_no: item.admission_no,
          avatar_url: item.avatar_url,
          belt_level: item.belt_level,
          country_code: item.country_code,
        },
        messageCount: item.message_count,
      }));
    };

    return NextResponse.json({
      daily: formatLeaderboard(daily),
      weekly: formatLeaderboard(weekly),
      allTime: formatLeaderboard(allTime),
      lastUpdated: now.toISOString(),
    });
  } catch (error: any) {
    console.error("Leaderboard error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get leaderboard" },
      { status: 500 },
    );
  }
}
