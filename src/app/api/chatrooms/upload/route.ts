import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "application/pdf",
  "text/plain",
];
const BUCKET = "chat-attachments";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const chatroomId = form.get("chatroomId") as string | null;

    if (!file || !chatroomId) {
      return NextResponse.json(
        { error: "file and chatroomId are required" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Max 5MB." },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "File type not allowed." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check chatroom exists and allows files (for fans, allow_files may be false)
    const { data: room, error: roomErr } = await supabase
      .from("chatrooms")
      .select("id, type, allow_files")
      .eq("id", chatroomId)
      .maybeSingle();

    if (roomErr || !room) {
      return NextResponse.json({ error: "Chatroom not found" }, { status: 404 });
    }

    if (!room.allow_files) {
      return NextResponse.json(
        { error: "File uploads not allowed in this chatroom." },
        { status: 403 }
      );
    }

    // For private rooms, require membership
    if (room.type !== "wsf_fans") {
      const { data: membership } = await supabase
        .from("chatroom_members")
        .select("status")
        .eq("chatroom_id", room.id)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (!membership) {
        return NextResponse.json(
          { error: "Not a member of this chatroom." },
          { status: 403 }
        );
      }
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const path = `${chatroomId}/${user.id}/${Date.now()}-${file.name}`;

    const { error: uploadErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadErr) {
      console.error("Upload error", uploadErr);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    const { data: signed } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60); // 1 hour

    return NextResponse.json({ url: signed?.signedUrl, path });
  } catch (err: any) {
    console.error("Upload route error", err);
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}

