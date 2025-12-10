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

    const targetCountry =
      chatroomId === "psa" || chatroomId === "nsa"
        ? country_code ?? profile.country_code ?? null
        : null;

    // Eligibility check against live data (with country context)
    const eligibility = await checkEligibility(
      supabase,
      profile,
      chatroomId,
      targetCountry
    );
    if (eligibility.state !== "eligible") {
      return NextResponse.json(
        { error: eligibility.reason ?? "Not eligible" },
        { status: 403 }
      );
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

    // Ensure chatroom exists (PSA/NSA are per-country). Fans/Students/ClubOwners/Committee are global singletons.
    const roomConfig = chatrooms.find((c) => c.id === chatroomId);

    const { data: upsertedRoom, error: upsertErr } = await supabaseAdmin
      .from("chatrooms")
      .upsert(
        {
          type: chatroomId,
          title: roomConfig?.title ?? chatroomId,
          country_code:
            chatroomId === "psa" || chatroomId === "nsa" ? targetCountry : null,
          visibility: roomConfig?.visibility ?? "private",
          shareable: chatroomId === "wsf_fans",
          allow_files: chatroomId === "wsf_club_owners" || chatroomId === "wsf_committee",
        },
        { onConflict: "type,country_code" }
      )
      .select()
      .maybeSingle();

    if (upsertErr || !upsertedRoom) {
      console.error("Upsert chatroom error", upsertErr);
      return NextResponse.json(
        { error: "Could not prepare chatroom" },
        { status: 500 }
      );
    }

    // Add membership (idempotent)
    const { error: memberErr } = await supabaseAdmin
      .from("chatroom_members")
      .upsert(
        {
          chatroom_id: upsertedRoom.id,
          user_id: user.id,
          status: "active",
          role: "member",
        },
        { onConflict: "chatroom_id,user_id" }
      );

    if (memberErr) {
      console.error("Join membership error", memberErr);
      return NextResponse.json({ error: "Could not join chatroom" }, { status: 500 });
    }

    return NextResponse.json({ chatroom_id: upsertedRoom.id });
  } catch (err: any) {
    console.error("Join route error", err);
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}

