import { SupabaseClient } from "@supabase/supabase-js";

export async function updateMessage(
  supabase: SupabaseClient,
  messageId: string,
  content: string
) {
  return supabase
    .from("messages")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("id", messageId);
}

export async function deleteMessage(
  supabase: SupabaseClient,
  messageId: string
) {
  return supabase.from("messages").delete().eq("id", messageId);
}

