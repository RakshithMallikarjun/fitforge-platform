import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { z } from "zod";
import { listThreads, listMyTrainers } from "@/lib/messages.functions";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ThreadView } from "@/components/messages/thread-view";

const search = z.object({ with: z.string().optional() });

export const Route = createFileRoute("/_authenticated/app/messages")({
  validateSearch: search,
  component: MessagesPage,
});

function MessagesPage() {
  const { with: withUser } = Route.useSearch();
  const navigate = useNavigate();
  const { data: me } = useCurrentUser();
  const fetchThreads = useServerFn(listThreads);
  const qc = useQueryClient();

  const fetchTrainers = useServerFn(listMyTrainers);

  const { data: threads, isLoading } = useQuery({
    queryKey: ["threads"],
    queryFn: () => fetchThreads(),
  });
  const { data: myTrainers } = useQuery({
    queryKey: ["my-trainers"],
    queryFn: () => fetchTrainers(),
  });

  // Realtime: refresh threads list on new inbound messages
  useEffect(() => {
    if (!me?.userId) return;
    const channel = supabase
      .channel(`inbox-${me.userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${me.userId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["threads"] });
          qc.invalidateQueries({ queryKey: ["unread-count"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [me?.userId, qc]);

  if (withUser) {
    const t = threads?.find((x) => x.otherUserId === withUser);
    const contact = myTrainers?.find((c) => c.id === withUser);
    const name =
      t?.otherUser?.display_name ?? t?.otherUser?.email ?? contact?.display_name ?? contact?.email ?? "Conversation";
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate({ to: "/app/messages" })}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Messages
        </button>
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Chat with</p>
          <h1 className="mt-1 font-display text-xl font-bold tracking-tight">{name}</h1>
        </div>
        <ThreadView otherUserId={withUser} className="h-[calc(100vh-260px)]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Inbox</p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">Messages</h1>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && (threads?.length ?? 0) === 0 && (
        <div className="grid place-items-center gap-2 rounded-2xl border border-dashed border-border py-12 text-sm text-muted-foreground">
          <MessageSquare className="h-6 w-6" />
          No conversations yet.
          {(myTrainers?.length ?? 0) > 0
            ? " Start one with your trainer below."
            : " Your trainer will message you here once you're assigned one."}
        </div>
      )}

      {/* Members can open a thread with any of their assigned trainers. */}
      {(myTrainers ?? []).filter((c) => !(threads ?? []).some((t) => t.otherUserId === c.id)).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Start a conversation
          </p>
          {(myTrainers ?? [])
            .filter((c) => !(threads ?? []).some((t) => t.otherUserId === c.id))
            .map((c) => {
              const cname = c.display_name ?? c.email;
              return (
                <Link
                  key={c.id}
                  to="/app/messages"
                  search={{ with: c.id }}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-card)] hover:bg-muted/40"
                >
                  <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-sm font-semibold text-primary">
                    {c.photo_url ? (
                      <img src={c.photo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      cname.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{cname}</p>
                    <p className="truncate text-xs text-muted-foreground">Your trainer · tap to message</p>
                  </div>
                </Link>
              );
            })}
        </div>
      )}
      <ul className="space-y-2">
        {(threads ?? []).map((t) => {
          const name = t.otherUser?.display_name ?? t.otherUser?.email ?? "Unknown";
          const initials = name.slice(0, 2).toUpperCase();
          return (
            <li key={t.otherUserId}>
              <Link
                to="/app/messages"
                search={{ with: t.otherUserId }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-card)] hover:bg-muted/40"
              >
                <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-sm font-semibold text-primary">
                  {t.otherUser?.photo_url ? (
                    <img src={t.otherUser.photo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{name}</p>
                    {t.lastMessage && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {new Date(t.lastMessage.created_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {t.lastMessage?.body ?? "No messages yet"}
                  </p>
                </div>
                {t.unreadCount > 0 && (
                  <span className="grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                    {t.unreadCount}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
