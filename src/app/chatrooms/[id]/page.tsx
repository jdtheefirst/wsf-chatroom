import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatroomMessages } from "@/components/chatrooms/ChatroomMessages";
import { chatrooms } from "@/lib/chatrooms/config";

type MessageRow = {
  user_id: string;
  id: string;
  content: string;
  language: string | null;
  translated_content?: Record<string, string> | null;
  file_url: string | null;
  created_at: string;
  user: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

type ChatroomRecord = {
  id: string;
  type: string;
  title: string;
  country_code: string | null;
  visibility: string;
  shareable: boolean;
  allow_files: boolean;
};

export default async function ChatroomPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const [{ data: userData }, { data: chatroom, error: chatroomError }] =
    await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from("chatrooms")
        .select("*")
        .eq("id", params.id)
        .maybeSingle(),
    ]);

  if (chatroomError || !chatroom) {
    return notFound();
  }

  const requiresMembership = chatroom.type !== "wsf_fans";
  const user = userData?.user ?? null;

  if (requiresMembership && !user) {
    redirect("/");
  }

  let isMember = false;
  if (requiresMembership && user) {
    const { data: membership } = await supabase
      .from("chatroom_members")
      .select("status")
      .eq("chatroom_id", chatroom.id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    isMember = Boolean(membership);
    if (!isMember) {
      redirect("/");
    }
  }

  const { data: messages } = await supabase
    .from("messages")
    .select(
      "id, content, language, file_url, created_at, user:users_profile ( id, full_name, avatar_url )"
    )
    .eq("chatroom_id", chatroom.id)
    .order("created_at", { ascending: true })
    .limit(50);

  const roomMeta =
    chatrooms.find((c) => c.id === chatroom.type) ??
    ({
      id: chatroom.type,
      title: chatroom.title,
      visibility: chatroom.visibility,
      access: "",
      features: [],
    } as any);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {roomMeta.visibility === "public" ? "Public" : "Restricted"}
        </p>
        <h1 className="text-2xl font-semibold">{chatroom.title}</h1>
        {roomMeta.access ? (
          <p className="text-sm text-muted-foreground">{roomMeta.access}</p>
        ) : null}
      </header>

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <ChatroomMessages
          chatroomId={chatroom.id}
          allowFiles={chatroom.allow_files}
          initialMessages={(messages as unknown as MessageRow[]) ?? []}
        />
      </section>
    </main>
  );
}

