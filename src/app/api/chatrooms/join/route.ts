import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { checkEligibility } from "@/lib/chatrooms/eligibility";
import { chatrooms } from "@/lib/chatrooms/config";
import { ChatroomType } from "@/lib/chatrooms/types";
import { countryByAssociation } from "@/lib/chatrooms/validation";

type JoinPayload = {
  chatroomId: ChatroomType;
  country_code?: string | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as JoinPayload;
    const { chatroomId, country_code } = body;
    const supabase = await createClient();

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: profile, error: profileErr } = await supabase
      .from("users_profile")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const targetCountry: string | null = 
      chatroomId === "psa" || chatroomId === "nsa"
        ? (country_code ?? profile.country_code ?? null)
        : null;

    const eligibility = await checkEligibility(
      supabase,
      profile,
      chatroomId,
      targetCountry
    );
    
    if (eligibility.state !== "eligible") {
      const reason = eligibility.state === "ineligible" ? eligibility.reason : "Not eligible";
      return NextResponse.json({ error: reason }, { status: 403 });
    }

    if (chatroomId === "psa" || chatroomId === "nsa") {
      const countryOk = await countryByAssociation(
        supabase,
        profile.id,
        targetCountry
      );
      if (!countryOk) {
        return NextResponse.json(
          { error: "Association country mismatch for PSA/NSA" },
          { status: 403 }
        );
      }
    }

    const roomConfig = chatrooms.find((c) => c.id === chatroomId);

    // Call the database function
    const { data: chatroomResult, error: chatroomError } = await supabase
      .rpc('get_or_create_chatroom', {
        p_type: chatroomId,
        p_title: roomConfig?.title ?? chatroomId,
        p_country_code: targetCountry,
        p_visibility: roomConfig?.visibility ?? "private",
        p_shareable: chatroomId === "wsf_fans",
        p_allow_files: 
          chatroomId === "wsf_club_owners" || chatroomId === "wsf_committee",
        p_created_by: user.id,
      });

    if (chatroomError) {
      console.error("Chatroom RPC error:", chatroomError);
      return NextResponse.json(
        { error: "Failed to get or create chatroom", details: chatroomError.message },
        { status: 500 }
      );
    }

    if (!chatroomResult) {
      console.error("Chatroom RPC returned null");
      return NextResponse.json(
        { error: "Chatroom not found or could not be created" },
        { status: 500 }
      );
    }

    // ✅ chatroomResult is the UUID string itself
    const chatroomIdToUse = chatroomResult;

    console.log('RPC successful, chatroom ID:', chatroomIdToUse);

    // Check if user is already a member
    const { data: existingMember } = await supabaseAdmin
      .from("chatroom_members")
      .select("chatroom_id")
      .eq("chatroom_id", chatroomIdToUse)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existingMember) {
      const { error: memberErr } = await supabaseAdmin
        .from("chatroom_members")
        .insert({
          chatroom_id: chatroomIdToUse,
          user_id: user.id,
          status: "active",
          role: "member",
        });

      if (memberErr) {
        console.error("Join membership error", memberErr);
        return NextResponse.json(
          { error: "Could not join chatroom" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ 
      chatroom_id: chatroomIdToUse,
      already_member: !!existingMember 
    });
  } catch (err: any) {
    console.error("Join route error", err);
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}

