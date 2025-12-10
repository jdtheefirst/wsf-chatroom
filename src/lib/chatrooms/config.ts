import { ChatroomDefinition } from "./types";

export const chatrooms: ChatroomDefinition[] = [
  {
    id: "wsf_fans",
    title: "WSF Fans",
    visibility: "public",
    access: "All authenticated users (fans, students, club owners, leaders)",
    notes: "Public posts are shareable externally. No large files.",
    features: ["Auto-translation", "Shareable posts"],
  },
  {
    id: "wsf_students",
    title: "WSF Students",
    visibility: "private",
    access: "Requires admission number (students only)",
    notes: "Private, no large files.",
    features: ["Auto-translation"],
  },
  {
    id: "wsf_club_owners",
    title: "WSF Club Owners",
    visibility: "private",
    access: "Club owners/managers based on club memberships",
    notes: "File sharing allowed.",
    features: ["Auto-translation", "File uploads"],
  },
  {
    id: "psa",
    title: "PSA (Provincial)",
    visibility: "private",
    access:
      "Provincial association roles (provincial_director, etc.) per country",
    notes: "Created on-demand per country association.",
    features: ["Auto-translation"],
  },
  {
    id: "nsa",
    title: "NSA (National)",
    visibility: "private",
    access: "National association members per country",
    notes: "Created on-demand per country association.",
    features: ["Auto-translation"],
  },
  {
    id: "wsf_committee",
    title: "WSF Committee",
    visibility: "private",
    access: "WSF top leadership (role: superadmin or leadership roles)",
    features: ["Auto-translation", "File uploads"],
  },
];

export const visibilityCopy = {
  public: "Public (posts visible to everyone, shareable)",
  private: "Private (visible only to members)",
} as const;

