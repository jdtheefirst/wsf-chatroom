// app/chatrooms/[id]/page.tsx
import { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatroomMessagesEnhanced } from "@/components/chatrooms/ChatroomMessages";
import { chatrooms } from "@/lib/chatrooms/config";
import { MessageRow, ChatroomRecord } from "@/lib/chatrooms/types";
import { generateChatroomMetadata } from "@/lib/chatrooms/metadata";
import { ChatroomShareButton } from "@/components/chatrooms/ChatroomShareButton";
import { cache } from "react";

// Add revalidation (1 hour)
export const revalidate = 3600; // 1 hour in seconds

// Cached data fetching - will be deduplicated across generateMetadata and page
const getChatroomData = cache(async (id: string) => {
  const supabase = await createClient();

  // Fetch all data in parallel
  const [
    { data: userData },
    { data: chatroom, error: chatroomError },
    { data: messages },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("chatrooms").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("messages")
      .select(
        `
        id,
        content,
        language,
        file_url,
        created_at,
        user_id,
        user: users_profile!messages_user_id_fkey (
          id,
          full_name,
          admission_no,
          avatar_url,
          belt_level,
          country_code
        )
      `
      )
      .eq("chatroom_id", id)
      .order("created_at", { ascending: true })
      .limit(50),
  ]);

  return {
    userData,
    chatroom,
    chatroomError,
    messages: messages as unknown as MessageRow[],
    supabase,
  };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  // This will be cached and reused by the page component
  const { chatroom, chatroomError } = await getChatroomData(id);

  if (!chatroom || chatroomError) {
    return {
      title: "Chatroom Not Found",
      description: "The requested chatroom could not be found",
    };
  }

  const roomMeta = chatrooms.find((c) => c.id === chatroom.type) ?? {
    id: chatroom.type,
    title: chatroom.title,
    visibility: chatroom.visibility,
  };

  // Include country in description for PSA and NSA
  const getCountryDescription = () => {
    if (chatroom.country_code && ["psa", "nsa"].includes(chatroom.type)) {
      return `${
        chatroom.title
      } - ${chatroom.country_code.toUpperCase()} Chatroom`;
    }
    return chatroom.title;
  };

  return generateChatroomMetadata(chatroom as ChatroomRecord, {
    ...roomMeta,
    title: getCountryDescription(),
  });
}

export default async function ChatroomPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const searchParamsObj = await searchParams;
  const messageId = searchParamsObj.messageId as string;

  // This will reuse the cached data from generateMetadata
  const { userData, chatroom, chatroomError, messages, supabase } =
    await getChatroomData(id);

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
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-2 sm:px-6 py-10">
      <header className="space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {roomMeta.visibility === "public" ? "Public" : "Restricted"}
            </p>
            <h1 className="text-2xl font-semibold">
              {chatroom.title}
              {chatroom.country_code &&
                ["psa", "nsa"].includes(chatroom.type) && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({chatroom.country_code.toUpperCase()})
                  </span>
                )}
            </h1>
            {roomMeta.access ? (
              <p className="text-sm text-muted-foreground">{roomMeta.access}</p>
            ) : null}
          </div>

          {/* Add share button */}
          {chatroom.shareable && (
            <ChatroomShareButton
              chatroom={chatroom as ChatroomRecord}
              roomMeta={roomMeta}
            />
          )}
        </div>
      </header>

      <section className="rounded-lg border bg-card p-2 sm:p-4 shadow-sm">
        <ChatroomMessagesEnhanced
          chatroom={chatroom}
          allowFiles={chatroom.allow_files}
          shareable={chatroom.shareable}
          initialMessages={messages ?? []}
          highlightedMessageId={messageId} // Pass the message ID to highlight
        />
      </section>
    </main>
  );
}
