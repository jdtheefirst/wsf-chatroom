// app/api/chatrooms/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const revalidate = 10; // Revalidate every 10 seconds
export const dynamic = "force-dynamic"; // Ensure it's not statically generated

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

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Helper function to get leaderboard data with optimized query
    const getLeaderboardData = async (startDate: Date, limit: number = 10) => {
      // Use a single query with count aggregation in the database
      const { data, error } = await supabaseAdmin
        .from("messages")
        .select(
          `
          user_id,
          users_profile!inner (
            id,
            full_name,
            admission_no,
            avatar_url,
            belt_level,
            country_code
          ),
          count
        `
        )
        .eq("chatroom_id", chatroomId)
        .gte("created_at", startDate.toISOString())
        .select("user_id, users_profile!inner(*)")
        .limit(1000); // Fetch more data for accurate counting

      if (error) throw error;

      // Manually count messages per user (more efficient than multiple queries)
      const userCounts = new Map<string, { count: number; user: any }>();

      data?.forEach((item: any) => {
        const userId = item.user_id;
        if (!userCounts.has(userId)) {
          userCounts.set(userId, {
            count: 0,
            user: item.users_profile,
          });
        }
        userCounts.get(userId)!.count++;
      });

      return Array.from(userCounts.entries())
        .map(([userId, data]) => ({
          user: data.user,
          messageCount: data.count,
        }))
        .sort((a, b) => b.messageCount - a.messageCount)
        .slice(0, limit);
    };

    // Use Promise.all to fetch all leaderboards concurrently
    const [daily, weekly, allTime] = await Promise.all([
      getLeaderboardData(yesterday, 10),
      getLeaderboardData(weekStart, 10),
      getLeaderboardData(ninetyDaysAgo, 10), // Limit to 90 days for performance
    ]);

    return NextResponse.json({
      daily,
      weekly,
      allTime,
      lastUpdated: now.toISOString(),
    });
  } catch (error: any) {
    console.error("Leaderboard error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get leaderboard" },
      { status: 500 }
    );
  }
}
