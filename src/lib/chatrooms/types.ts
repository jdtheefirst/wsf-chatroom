import { EventData } from "@/components/chatrooms/EventReference";

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

export type UserProfile = {
  id: string;
  full_name: string | null;
  admission_no: string | null;
  email?: string | null;
  avatar_url: string | null;
  belt_level?: number;
  role?: string;
  elite_plus?: boolean;
  overall_performance?: string | null;
  completed_all_programs?: boolean;
  elite_plus_level?: number | null;
  is_wsf?: boolean;
};

export type MessageRow = {
  user_id: string;
  id: string;
  content: string;
  language: string | null;
  translated_content?: Record<string, string> | null;
  file_url: string | null;
  created_at: string;
  user_profile: UserProfile | null;
  reply_to?: string | null;
  reply_is_private?: boolean;
  reply_to_message?: MessageRow | null; // For hydrated replies
  reactions_count?: Record<string, number>; // { "👍": 3, "❤️": 1 }
  user_reactions?: string[]; // ["👍", "❤️"] - reactions by current user
  priority?: "normal" | "urgent" | "announcement";
  is_broadcast?: boolean;
  event_id?: string | null;
  event_data?: EventData; // Joined from events table
  event_reminder_data?: {
    remind_at?: string;
    notified_users?: string[];
  } | null; // Joined from event_reminders table
  poll_data?: {
    question: string;
    is_multi_select: boolean;
    expires_at: string;
    total_votes: number;
    options: Array<{
      id: string;
      text: string;
      image_url: string | null;
      vote_count: number;
    }>;
    user_votes: string[];
  } | null; // For messages that are polls
  audio_data?: {
    url: string;
    duration: number;
    waveform_data: number[];
    size_bytes?: number;
  } | null; // For messages that are audio recordings
  view_count: number; // For tracking message views
  scheduled_at?: string | null;
};

// Add Reaction type
export type Reaction = {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  user?: UserProfile | null;
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
