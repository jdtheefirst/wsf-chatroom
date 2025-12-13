export type PresenceUser = {
  id: string;
  full_name: string | null;
  admission_no: string | null;
  avatar_url: string | null;
  belt_level: number;
  country_code: string;
  last_seen: number; // Unix timestamp
  status: "online" | "away" | "offline";
};
