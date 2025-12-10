"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/context/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { deleteMessage, updateMessage } from "@/lib/chatrooms/messages";
import { supportedLanguages, findLanguage, LanguageCode } from "@/lib/chatrooms/languages";
import { translateText } from "@/lib/chatrooms/translation";
import { Alert } from "@/components/ui/alert";
import { toast as sonnerToast } from "sonner";

type MessageRow = {
  id: string;
  content: string;
  language: string | null;
  translated_content?: Record<string, string> | null;
  file_url: string | null;
  created_at: string;
  user: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

type Props = {
  chatroomId: string;
  allowFiles: boolean;
  initialMessages: MessageRow[];
};

export function ChatroomMessages({
  chatroomId,
  allowFiles,
  initialMessages,
}: Props) {
  const { profile } = useAuth();
  const supabase = getSupabaseClient();
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [targetLang, setTargetLang] = useState<LanguageCode>("en");
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const listRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const subscription = supabase
      .channel(`messages:${chatroomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `chatroom_id=eq.${chatroomId}` },
        async (payload) => {
          const row = payload.new as MessageRow;
          if (!row.user) {
            const { data: userProfile } = await supabase
              .from("users_profile")
              .select("id, full_name, avatar_url")
              .eq("id", row.user_id as string)
              .maybeSingle();
            (row as any).user = userProfile ?? null;
          }
          setMessages((prev) => [...prev, row]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [chatroomId, supabase]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!profile) {
      sonnerToast.error("Please sign in to send messages.");
      return;
    }
    if (!input.trim()) return;
    setSending(true);
    const text = input;
    setInput("");
    try {
      let fileUrl: string | null = null;
      if (file && allowFiles) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("chatroomId", chatroomId);
        const uploadRes = await fetch("/api/chatrooms/upload", {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) {
          const data = await uploadRes.json().catch(() => ({}));
          throw new Error(data.error || "Upload failed");
        }
        const data = await uploadRes.json();
        fileUrl = data.path;
        if (data.url) {
          setFileUrls((prev) => ({ ...prev, [data.path]: data.url }));
        }
      }

      const { error } = await supabase.from("messages").insert({
        chatroom_id: chatroomId,
        content: text,
        language: "en",
        file_url: fileUrl,
      });
      if (error) {
        throw error;
      }
    } catch (err) {
      console.error(err);
      sonnerToast.error((err as Error).message || "Failed to send message");
      setInput(text); // restore
    } finally {
      setFile(null);
      setSending(false);
    }
  };

  const showContent = (m: MessageRow) => {
    if (targetLang === "en") return m.content;
    const translated = m.translated_content?.[targetLang];
    return translated ?? m.content;
  };

  const translateMessage = async (m: MessageRow) => {
    if (!m.content) return;
    if (m.translated_content?.[targetLang]) return;
    try {
      const translated = await translateText(m.content, targetLang);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === m.id
            ? {
                ...msg,
                translated_content: {
                  ...(msg.translated_content ?? {}),
                  [targetLang]: translated,
                },
              }
            : msg
        )
      );
    } catch (err) {
      console.error(err);
      sonnerToast.error("Translation failed");
    }
  };

  const startEdit = (id: string, content: string) => {
    setEditingId(id);
    setEditText(content);
  };

  const saveEdit = async () => {
    if (!editingId || !editText.trim()) {
      setEditingId(null);
      setEditText("");
      return;
    }
    try {
      const { error } = await updateMessage(supabase, editingId, editText);
      if (error) throw error;
      setMessages((prev) =>
        prev.map((m) => (m.id === editingId ? { ...m, content: editText } : m))
      );
      setEditingId(null);
      setEditText("");
      sonnerToast.success("Message updated");
    } catch (err) {
      console.error(err);
      sonnerToast.error("Failed to update message");
    }
  };

  const removeMessage = async (id: string) => {
    try {
      const { error } = await deleteMessage(supabase, id);
      if (error) throw error;
      setMessages((prev) => prev.filter((m) => m.id !== id));
      sonnerToast.success("Message deleted");
    } catch (err) {
      console.error(err);
      sonnerToast.error("Failed to delete message");
    }
  };

  // Resolve signed URLs for attachments
  useEffect(() => {
    const paths = messages
      .map((m) => m.file_url)
      .filter((p): p is string => Boolean(p))
      .filter((p) => !fileUrls[p]);
    if (paths.length === 0) return;

    let cancelled = false;
    const fetchUrls = async () => {
      const entries = await Promise.all(
        paths.map(async (path) => {
          try {
            const res = await fetch("/api/chatrooms/file-url", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ path }),
            });
            if (!res.ok) throw new Error("Signed URL fetch failed");
            const data = await res.json();
            return [path, data.url as string] as const;
          } catch (err) {
            console.error(err);
            return [path, "" as string] as const;
          }
        })
      );
      if (!cancelled) {
        setFileUrls((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      }
    };
    fetchUrls();
    return () => {
      cancelled = true;
    };
  }, [messages, fileUrls]);

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={listRef}
        className="max-h-[60vh] overflow-y-auto rounded-md border bg-muted/30 p-3 space-y-3"
      >
        {!allowFiles ? (
          <Alert className="bg-muted text-muted-foreground border-dashed border">
            File uploads are disabled in this chatroom.
          </Alert>
        ) : null}
        {messages.map((m) => {
          const isSelf = m.user?.id === profile?.id;
          const isEditing = editingId === m.id;
          return (
            <div
              key={m.id}
              className={cn(
                "flex flex-col gap-1 rounded-lg bg-background p-3 shadow-sm",
                isSelf ? "border-primary/40 border" : "border"
              )}
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {m.user?.full_name || "User"}
                </span>
                <span>{format(new Date(m.created_at), "PP p")}</span>
              </div>
              {isEditing ? (
                <div className="flex flex-col gap-2">
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit}>
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingId(null);
                        setEditText("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-foreground">{showContent(m)}</p>
                  <div className="flex items-center gap-2">
                    <select
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      value={targetLang}
                      onChange={(e) => setTargetLang(e.target.value as LanguageCode)}
                    >
                      {supportedLanguages.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.label}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => translateMessage(m)}
                    >
                      Translate
                    </Button>
                  </div>
                </div>
              )}

              {m.file_url ? (
                fileUrls[m.file_url] ? (
                  <a
                    className="text-xs text-primary underline"
                    href={fileUrls[m.file_url]}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Attachment
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">Attachment loading...</span>
                )
              ) : null}

              {isSelf ? (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(m.id, m.content)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => removeMessage(m.id)}>
                    Delete
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            No messages yet.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Textarea
          placeholder="Write a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {allowFiles ? "Attachments allowed (size limits enforced server-side)." : "Files disabled in this room."}
          </span>
          <div className="flex items-center gap-2">
            {allowFiles ? (
              <Input
                type="file"
                accept="*/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={sending}
                className="h-10 max-w-[200px]"
              />
            ) : null}
            <Button onClick={sendMessage} disabled={sending || !input.trim()}>
            {sending ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

