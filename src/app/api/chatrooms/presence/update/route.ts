// app/api/presence/update/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export async function POST(request: NextRequest) {
  try {
    const { userId, chatroomId, status } = await request.json();
    
    if (!userId || !chatroomId || !status) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    await supabaseAdmin.rpc('update_user_presence', {
      p_user_id: userId,
      p_chatroom_id: chatroomId,
      p_status: status,
    });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Presence update error:', error);
    return NextResponse.json(
      { error: error.message || "Failed to update presence" },
      { status: 500 }
    );
  }
}