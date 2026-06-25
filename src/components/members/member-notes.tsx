import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Loader2, Trash2, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createMemberNote, deleteMemberNote, listMemberNotes } from "@/lib/members.functions";
import { useCurrentUser } from "@/hooks/use-current-user";

export function MemberNotes({ memberId }: { memberId: string }) {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const [body, setBody] = useState("");

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["member-notes", memberId],
    queryFn: () => listMemberNotes({ data: { memberId } }),
  });

  const create = useMutation({
    mutationFn: () => createMemberNote({ data: { memberId, body } }),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["member-notes", memberId] });
    },
    onError: (e: any) => toast.error("Could not save note", { description: e?.message }),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteMemberNote({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["member-notes", memberId] }),
    onError: (e: any) => toast.error("Could not delete note", { description: e?.message }),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <Textarea
          rows={3}
          placeholder="Add a private note — only trainers and admins can see this."
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="mt-2 flex justify-end">
          <Button size="sm" disabled={!body.trim() || create.isPending} onClick={() => create.mutate()}>
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add note
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : notes.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-2xl border border-dashed border-border py-12 text-sm text-muted-foreground">
          <StickyNote className="h-6 w-6" />
          No notes yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {notes.map((n: any) => (
            <li key={n.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">
                    {n.author?.display_name ?? n.author?.email ?? "Unknown"}
                    <span className="ml-2 font-normal text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </span>
                  </p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm">{n.body}</p>
                </div>
                {n.author_id === me?.userId && (
                  <button
                    onClick={() => del.mutate(n.id)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                    aria-label="Delete note"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
