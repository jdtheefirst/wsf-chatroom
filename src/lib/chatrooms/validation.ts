import { SupabaseClient } from "@supabase/supabase-js";

export async function countryByAssociation(
  supabase: SupabaseClient,
  userId: string,
  countryCode: string | null
) {
  if (!countryCode) return false;

  // Assumes associations table has country_code column
  const { data, error } = await supabase
    .from("association_memberships")
    .select("association_id, role, associations(country_code)")
    .eq("user_id", userId)
    .eq("associations.country_code", countryCode)
    .limit(1);

  if (error) {
    console.error("countryByAssociation error", error);
    return false;
  }

  return (data?.length ?? 0) > 0;
}

