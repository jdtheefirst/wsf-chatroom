// lib/types/election.ts
export interface Election {
  id: string;
  association_name: string;
  country_code: string;
  county_code?: string;
  window_starts_at: string;
  window_ends_at: string;
  status: "upcoming" | "active" | "completed" | "cancelled";
  nominee_count: number;
  vote_count: number;
  eligible_voters: number;
  total_votes?: number;
}

export interface Nomination {
  id: string;
  nominee_id: string;
  nominee_name: string;
  nominee_avatar?: string;
  position: string;
  vision_statement?: string;
  votes_count: number;
  has_voted?: boolean;
}

export interface VoteResult {
  nomination_id: string;
  nominee_name: string;
  votes_count: number;
  percentage: number;
}
