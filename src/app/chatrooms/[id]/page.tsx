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

export const revalidate = 3600;

const getChatroomData = cache(async (id: string, userId?: string) => {
  const supabase = await createClient();

  const [{ data: userData }, { data: chatroom, error: chatroomError }] =
    await Promise.all([
      supabase.auth.getUser(),
      supabase.from("chatrooms").select("*").eq("id", id).maybeSingle(),
    ]);

  const { data: messages } = await supabase
    .from("messages")
    .select(
      `
      id,
      content,
      language,
      file_url,
      created_at,
      user_id,
      reply_to,
      reply_is_private,
      reactions_count,
      priority,
      is_broadcast,
      event_id,
      event_reminder_data,
      poll_data,
      audio_data,
      view_count,
      scheduled_at,
      user_profile:users_profile!messages_user_id_fkey (
        id,
        full_name,
        admission_no,
        avatar_url,
        belt_level,
        country_code,
        elite_plus,
        overall_performance,
        completed_all_programs,
        elite_plus_level,
        is_wsf
      )
    `,
    )
    .eq("chatroom_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!messages || messages.length === 0) {
    return {
      userData,
      chatroom,
      chatroomError,
      messages: [] as MessageRow[],
      supabase,
    };
  }

  // Get all unique reply IDs
  const replyIds = [
    ...new Set(
      messages
        .filter((msg: any) => msg.reply_to)
        .map((msg: any) => msg.reply_to),
    ),
  ];

  // Fetch replied messages if any
  let repliedMessages: any[] = [];
  if (replyIds.length > 0) {
    const { data: repliedData } = await supabase
      .from("messages")
      .select(
        `
        id,
        content,
        language,
        file_url,
        audio_data,
        view_count,
        poll_data,
        event_id,
        event_reminder_data,
        created_at,
        user_id,
        user_profile:users_profile!messages_user_id_fkey (
          id,
          full_name,
          admission_no,
          avatar_url,
          belt_level,
          country_code,
          elite_plus,
          overall_performance,
          completed_all_programs,
          elite_plus_level,
          is_wsf
        )
      `,
      )
      .in("id", replyIds);

    repliedMessages = repliedData || [];
  }

  // === NEW: Fetch poll votes for current user ===
  let userPollVotes: any[] = [];
  const currentUserId = userData?.user?.id;

  if (currentUserId) {
    // Get messages that have polls
    const pollMessageIds = messages
      .filter((msg: any) => msg.poll_data)
      .map((msg: any) => msg.id);

    if (pollMessageIds.length > 0) {
      const { data: votes } = await supabase
        .from("poll_votes")
        .select("message_id, option_id")
        .in("message_id", pollMessageIds)
        .eq("user_id", currentUserId);

      userPollVotes = votes || [];
    }
  }

  // Create a map for quick reply lookup
  const repliedMessagesMap = new Map();
  repliedMessages.forEach((msg: any) => {
    repliedMessagesMap.set(msg.id, msg);
  });

  // Create a map for user poll votes (message_id -> array of option_ids)
  const pollVotesMap = new Map();
  userPollVotes.forEach((vote: any) => {
    if (!pollVotesMap.has(vote.message_id)) {
      pollVotesMap.set(vote.message_id, []);
    }
    pollVotesMap.get(vote.message_id).push(vote.option_id);
  });

  // Hydrate messages with replies and poll votes
  const hydratedMessages = messages.map((msg: any) => {
    // Check if this message has a poll and user has voted on it
    let pollDataWithUserVotes = msg.poll_data;
    if (msg.poll_data && pollVotesMap.has(msg.id)) {
      pollDataWithUserVotes = {
        ...msg.poll_data,
        user_votes: pollVotesMap.get(msg.id),
      };
    }

    return {
      ...msg,
      poll_data: pollDataWithUserVotes,
      reply_to_message: msg.reply_to
        ? repliedMessagesMap.get(msg.reply_to)
        : null,
      reactions_count: msg.reactions_count || {},
      user_reactions: [],
      translated_content: {},
    };
  });

  return {
    userData,
    chatroom,
    chatroomError,
    messages: hydratedMessages.reverse() as MessageRow[],
    supabase,
  };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
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

  const getCountryDescription = () => {
    if (chatroom.country_code && ["psa", "nsa"].includes(chatroom.type)) {
      return `${chatroom.title} - ${chatroom.country_code.toUpperCase()} Chatroom`;
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
          highlightedMessageId={messageId}
        />
      </section>
    </main>
  );
}
