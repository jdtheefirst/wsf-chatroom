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
  access: string;
  notes?: string;
  features: string[];
};

export type EligibilityStatus =
  | { state: "loading" }
  | { state: "eligible" }
  | { state: "ineligible"; reason: string };

