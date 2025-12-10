import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { chatrooms } from "@/lib/chatrooms/config";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ChatroomIndex() {
  const supabase = await createClient();
  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id ?? null;

  let joined: { chatroom_id: string }[] = [];
  if (userId) {
    const { data } = await supabase
      .from("chatroom_members")
      .select("chatroom_id")
      .eq("user_id", userId)
      .eq("status", "active");
    joined = data ?? [];
  }

  // Always show fans chatroom as public entry point
  const rooms = chatrooms;

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">Chatrooms</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Your chatrooms
        </h1>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        {rooms.map((room) => {
          const isJoined = joined.some((j) => j.chatroom_id === room.id);
          return (
            <Card key={room.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle>{room.title}</CardTitle>
                  <Badge variant="outline">{room.visibility}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{room.access}</p>
                <div className="flex items-center gap-3">
                  <Link
                    className="text-sm font-medium text-primary underline"
                    href={`/chatrooms/${room.id}`}
                  >
                    {isJoined || room.visibility === "public"
                      ? "Open"
                      : "View info"}
                  </Link>
                  {isJoined ? (
                    <Badge>Joined</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Join from discovery to access
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </main>
  );
}

