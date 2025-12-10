import { createClient } from "@/lib/supabase/server";

export default async function FansPublicPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chatrooms")
    .select("id")
    .eq("type", "wsf_fans")
    .maybeSingle();

  if (data?.id) {
    return (
      <div className="mx-auto max-w-4xl px-2 sm:px-6 py-10">
        <div className="space-y-2">
          <p className="text-sm font-medium text-primary">WSF Fans</p>
          <h1 className="text-3xl font-semibold tracking-tight">Public feed</h1>
          <p className="text-muted-foreground">
            This feed is shareable. Sign in to post; anyone can read.
          </p>
        </div>
        <div className="mt-6 rounded-lg border bg-card p-4">
          {/* Reuse message component? For brevity, simple link to main room */}
          <p className="text-sm text-muted-foreground">
            Open the fans chatroom to view the live feed.
          </p>
          <a
            className="text-primary underline"
            href={`/chatrooms/${data.id}`}
          >
            Go to fans chatroom
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <p className="text-sm text-muted-foreground">Fans chatroom not found.</p>
    </div>
  );
}

