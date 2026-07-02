import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { getThread, markRead, sendMessage } from "@/lib/messages.functions";
import { useCurrentUser } from "@/hooks/use-current-user";

type Msg = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export function ThreadView({ otherUserId, className }: { otherUserId: string; className?: string }) {
  const { data: me } = useCurrentUser();
  const meId = me?.userId;
  const qc = useQueryClient();
  const fetchThread = useServerFn(getThread);
  const sendFn = useServerFn(sendMessage);
  const markFn = useServerFn(markRead);

  const { data, isLoading } = useQuery({
    queryKey: ["thread", otherUserId],
    queryFn: () => fetchThread({ data: { otherUserId } }),
    enabled: !!otherUserId,
  });

  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // Realtime: append new messages from either direction
  useEffect(() => {
    if (!meId || !otherUserId) return;
    const channel = supabase
      .channel(`thread-${meId}-${otherUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as Msg;
          const relevant =
            (m.sender_id === meId && m.recipient_id === otherUserId) ||
            (m.sender_id === otherUserId && m.recipient_id === meId);
          if (!relevant) return;
          qc.setQueryData<any>(["thread", otherUserId], (cur: any) =>
            cur ? { ...cur, messages: [...cur.messages.filter((x: Msg) => x.id !== m.id), m] } : cur,
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [meId, otherUserId, qc]);

  // Mark received messages as read on open + when new arrive
  useEffect(() => {
    if (!data?.messages?.length || !meId) return;
    const hasUnread = data.messages.some((m: Msg) => m.recipient_id === meId && !m.read_at);
    if (hasUnread) {
      markFn({ data: { senderId: otherUserId } }).then(() => {
        qc.invalidateQueries({ queryKey: ["threads"] });
        qc.invalidateQueries({ queryKey: ["unread-count"] });
      });
    }
  }, [data, meId, otherUserId, markFn, qc]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [data?.messages?.length]);

  const send = useMutation({
    mutationFn: () => sendFn({ data: { recipientId: otherUserId, body: text.trim() } }),
    onSuccess: (msg: any) => {
      qc.setQueryData<any>(["thread", otherUserId], (cur: any) =>
        cur ? { ...cur, messages: [...cur.messages.filter((x: Msg) => x.id !== msg.id), msg] } : cur,
      );
      setText("");
      qc.invalidateQueries({ queryKey: ["threads"] });
    },
    onError: (e: any) => toast.error("Could not send", { description: e?.message }),
  });

  const grouped = useMemo(() => (data?.messages ?? []) as Msg[], [data]);

  return (
    <div className={["flex flex-col overflow-hidden rounded-2xl border border-border bg-card", className ?? "h-[520px]"].join(" ")}>
      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-4">
        {isLoading && <p className="text-center text-xs text-muted-foreground">Loading…</p>}
        {!isLoading && grouped.length === 0 && (
          <p className="text-center text-xs text-muted-foreground">No messages yet — say hi.</p>
        )}
        {grouped.map((m) => {
          const mine = m.sender_id === meId;
          return (
            <div key={m.id} className={["flex", mine ? "justify-end" : "justify-start"].join(" ")}>
              <div
                className={[
                  "max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                  mine
                    ? "rounded-br-md bg-primary text-primary-foreground"
                    : "rounded-bl-md bg-muted text-foreground",
                ].join(" ")}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={["mt-1 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground"].join(" ")}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim() || send.isPending) return;
          send.mutate();
        }}
        className="flex items-center gap-2 border-t border-border bg-card p-3"
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          className="rounded-xl"
        />
        <Button type="submit" size="icon" className="rounded-xl" disabled={!text.trim() || send.isPending}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
