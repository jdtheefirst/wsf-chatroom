export type PresenceUser = {
  id: string;
  full_name: string | null;
  admission_no: string | null;
  avatar_url: string | null;
  belt_level: number;
  country_code: string;
  elite_plus?: boolean;
  overall_performance?: string;
  completed_all_programs?: boolean;
  elite_plus_level?: number;
  last_seen: number; // Unix timestamp
  status: "online" | "away" | "offline";
};
