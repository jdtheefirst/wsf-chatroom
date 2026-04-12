// app/sitemap.ts
import type { MetadataRoute } from "next";
import { chatroomsUuid } from "@/lib/chatrooms/config"; // Import your static array

export default function sitemap(): MetadataRoute.Sitemap {
  // Generate entries for each static chatroom
  const chatroomEntries = chatroomsUuid.map((room) => ({
    url: `https://chat.worldsamma.org/chatrooms/${room.uuid}`,
    lastModified: new Date(), // Or use a specific date if you track updates
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [
    {
      url: "https://chat.worldsamma.org",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: "https://chat.worldsamma.org/chatrooms",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...chatroomEntries,
  ];
}
