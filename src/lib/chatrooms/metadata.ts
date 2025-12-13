// lib/chatrooms/metadata.ts
import { ChatroomType, ChatroomRecord } from "./types";

export function generateChatroomMetadata(
  chatroom: ChatroomRecord,
  roomMeta: any
) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://yourdomain.com";

  // Get the appropriate description based on type and country
  const getDescription = () => {
    const type = chatroom.type as ChatroomType;
    const country = chatroom.country_code
      ? ` (${chatroom.country_code.toUpperCase()})`
      : "";

    const descriptions: Record<ChatroomType, string> = {
      wsf_fans: `Join the conversation with fans worldwide${country}`,
      wsf_students: `Student-exclusive chatroom for members${country}`,
      wsf_club_owners: `Network with WSF club owners and instructors${country}`,
      psa: `Professional Samma Association discussion forum${country}`,
      nsa: `National Samma Association members chat${country}`,
      wsf_committee: `WSF Committee internal discussions${country}`,
    };

    return (
      descriptions[type] ||
      `Join the ${chatroom.title}${country} community discussion`
    );
  };

  // Get appropriate image based on type and country
  const getImageUrl = () => {
    const type = chatroom.type as ChatroomType;

    const images: Record<ChatroomType, string> = {
      wsf_fans: `${baseUrl}/og/chatroom-fans.jpg`,
      wsf_students: `${baseUrl}/og/chatroom-students.jpg`,
      wsf_club_owners: `${baseUrl}/og/chatroom-owners.jpg`,
      psa: `${baseUrl}/og/chatroom-psa.jpg`,
      nsa: `${baseUrl}/og/chatroom-nsa.jpg`,
      wsf_committee: `${baseUrl}/og/chatroom-committee.jpg`,
    };

    return images[type] || `${baseUrl}/og/chatroom-default.jpg`;
  };

  // Create title with country for PSA/NSA
  const title =
    ["psa", "nsa"].includes(chatroom.type) && chatroom.country_code
      ? `${
          chatroom.title
        } (${chatroom.country_code.toUpperCase()}) | WSF Chatroom`
      : `${chatroom.title} | WSF Chatroom`;

  return {
    title,
    description: getDescription(),
    openGraph: {
      title,
      description: getDescription(),
      type: "website",
      url: `${baseUrl}/chatrooms/${chatroom.id}`,
      images: [
        {
          url: getImageUrl(),
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      siteName: "World Samma Federation",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: getDescription(),
      images: [getImageUrl()],
    },
  };
}
