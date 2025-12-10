import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

const BUCKET = "chat-attachments";

export async function POST(req: Request) {
  try {
    const { path } = (await req.json()) as { path?: string };
    if (!path) {
      return NextResponse.json({ error: "path is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60);

    if (error) {
      console.error("Signed URL error", error);
      return NextResponse.json({ error: "Failed to sign URL" }, { status: 500 });
    }

    return NextResponse.json({ url: data?.signedUrl });
  } catch (err: any) {
    console.error("file-url route error", err);
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}

