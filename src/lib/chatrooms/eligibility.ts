import { SupabaseClient } from "@supabase/supabase-js";
import { ProfileData } from "@/lib/types/student";
import { ChatroomType, EligibilityStatus } from "./types";

type AllowedMembership = {
  table: "club_memberships" | "association_memberships";
  field: "membership_type" | "role";
  allowed: string[];
};

const clubOwnerRoles: AllowedMembership = {
  table: "club_memberships",
  field: "membership_type",
  allowed: ["assistant_coach", "coach", "admin"],
};

const provincialRoles: AllowedMembership = {
  table: "association_memberships",
  field: "role",
  allowed: [
    "assistant_director",
    "provincial_director",
    "director",
    "president",
  ],
};

const nationalRoles: AllowedMembership = {
  table: "association_memberships",
  field: "role",
  allowed: [
    "member",
    "assistant_director",
    "provincial_director",
    "director",
    "president",
  ],
};

async function hasMembership(
  supabase: SupabaseClient,
  userId: string,
  rule: AllowedMembership
) {
  const { data, error } = await supabase
    .from(rule.table)
    .select(rule.field)
    .eq("user_id", userId)
    .in(rule.field, rule.allowed)
    .limit(1);

  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function checkEligibility(
  supabase: SupabaseClient,
  profile: ProfileData | null,
  room: ChatroomType,
  countryCode?: string | null
): Promise<EligibilityStatus> {
  if (!profile) {
    return { state: "ineligible", reason: "Sign in to see eligibility." };
  }

  try {
    switch (room) {
      case "wsf_fans":
        return { state: "eligible" };

      case "wsf_students":
        return profile.admission_no
          ? { state: "eligible" }
          : { state: "ineligible", reason: "Admission number required." };

      case "wsf_club_owners": {
        const ok = await hasMembership(supabase, profile.id!, clubOwnerRoles);
        return ok
          ? { state: "eligible" }
          : { state: "ineligible", reason: "Club owner/manager membership required." };
      }

      case "psa": {
        if (!countryCode) {
          return { state: "ineligible", reason: "Country code required for PSA chatroom." };
        }
        const ok = await hasMembership(supabase, profile.id!, provincialRoles);
        return ok
          ? { state: "eligible" }
          : { state: "ineligible", reason: "Provincial association leadership required." };
      }

      case "nsa": {
        if (!countryCode) {
          return { state: "ineligible", reason: "Country code required for NSA chatroom." };
        }
        const ok = await hasMembership(supabase, profile.id!, nationalRoles);
        return ok
          ? { state: "eligible" }
          : { state: "ineligible", reason: "National association membership required." };
      }

      case "wsf_committee": {
        const isLeader =
          profile.role === "superadmin" || profile.role === "admin";
        return isLeader
          ? { state: "eligible" }
          : { state: "ineligible", reason: "WSF leadership role required." };
      }

      default:
        return { state: "ineligible", reason: "Unknown chatroom." };
    }
  } catch (err: any) {
    console.error("Eligibility check failed", err?.message ?? err);
    return { state: "ineligible", reason: "Error checking eligibility." };
  }
}

