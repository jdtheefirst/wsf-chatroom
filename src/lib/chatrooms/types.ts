export type ChatroomType =
  | "wsf_fans"
  | "wsf_students"
  | "wsf_club_owners"
  | "psa"
  | "nsa"
  | "wsf_committee";

export type ChatroomDefinition = {
  id: ChatroomType;
  title: string;
  visibility: "public" | "private";
  subtitle: string;
  access: string;
  notes?: string;
  features: string[];
  color: string;
};

export type EligibilityStatus =
  | { state: "loading" }
  | { state: "eligible" }
  | { state: "ineligible"; reason: string };

export type MessageRow = {
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
    email?: string | null;
    avatar_url: string | null;
    belt_level?: number;
    role?: string;
  } | null;
};

export type ChatroomRecord = {
  id: string;
  type: string;
  title: string;
  country_code: string | null;
  visibility: string;
  shareable: boolean;
  allow_files: boolean;
};
