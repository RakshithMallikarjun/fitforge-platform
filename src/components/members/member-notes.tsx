import { useState } from "react";
import { formatServerError } from "@/lib/format-error";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Loader2, Trash2, StickyNote, Eye, Pencil } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  createMemberNote,
  deleteMemberNote,
  listMemberNotes,
  setMemberNoteShared,
  updateMemberNote,
} from "@/lib/members.functions";
import { useCurrentUser } from "@/hooks/use-current-user";

export function MemberNotes({ memberId }: { memberId: string }) {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const [body, setBody] = useState("");
  const [shareNew, setShareNew] = useState(false);
  const [editing, setEditing] = useState<{ id: string; body: string; shared: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  const isAdmin = !!me?.roles.includes("admin");

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["member-notes", memberId],
    queryFn: () => listMemberNotes({ data: { memberId } }),
  });

  const create = useMutation({
    mutationFn: () => createMemberNote({ data: { memberId, body, sharedWithMember: shareNew } }),
    onSuccess: () => {
      setBody("");
      setShareNew(false);
      qc.invalidateQueries({ queryKey: ["member-notes", memberId] });
    },
    onError: (e: any) => toast.error("Could not save note", { description: formatServerError(e) }),
  });

  const share = useMutation({
    mutationFn: (v: { id: string; shared: boolean }) => setMemberNoteShared({ data: v }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ["member-notes", memberId] });
      toast.success(v.shared ? "Note shared with the member" : "Note is private again");
    },
    onError: (e: any) => toast.error("Could not update note", { description: formatServerError(e) }),
  });

  const edit = useMutation({
    mutationFn: (v: { id: string; body: string; shared: boolean }) => updateMemberNote({ data: v }),
    onSuccess: () => {
      setEditing(null);
      toast.success("Note updated");
      qc.invalidateQueries({ queryKey: ["member-notes", memberId] });
    },
    onError: (e: any) => toast.error("Could not update note", { description: formatServerError(e) }),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteMemberNote({ data: { id } }),
    onSuccess: () => {
      toast.success("Note deleted");
      qc.invalidateQueries({ queryKey: ["member-notes", memberId] });
    },
    onError: (e: any) => toast.error("Could not delete note", { description: formatServerError(e) }),
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
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Switch id="share-new-note" checked={shareNew} onCheckedChange={setShareNew} />
            <Label htmlFor="share-new-note" className="text-xs text-muted-foreground">
              Share with member
            </Label>
          </div>
          <Button
            size="sm"
            disabled={!body.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
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
          {notes.map((n: any) => {
            const mine = n.author_id === me?.userId;
            const isEditing = editing?.id === n.id;
            return (
              <li key={n.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <span className="font-semibold text-foreground">
                        {n.author?.display_name ?? n.author?.email ?? "Unknown"}
                      </span>
                      <span className="text-muted-foreground">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </span>
                      {n.edited && <span className="text-muted-foreground">· edited</span>}
                      {n.shared_with_member && (
                        <Badge variant="secondary" className="gap-1 text-[10px]">
                          <Eye className="h-3 w-3" /> Shared
                        </Badge>
                      )}
                    </p>
                    {isEditing ? (
                      <div className="mt-2 space-y-2">
                        <Textarea
                          rows={3}
                          value={editing!.body}
                          onChange={(e) => setEditing({ ...editing!, body: e.target.value })}
                          aria-label="Edit note"
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Switch
                              id={`edit-share-${n.id}`}
                              checked={editing!.shared}
                              onCheckedChange={(v) => setEditing({ ...editing!, shared: v })}
                            />
                            <Label htmlFor={`edit-share-${n.id}`} className="text-xs text-muted-foreground">
                              Share with member
                            </Label>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              disabled={!editing!.body.trim() || edit.isPending}
                              onClick={() => edit.mutate(editing!)}
                            >
                              {edit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Save
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="mt-1.5 whitespace-pre-wrap text-sm">{n.body}</p>
                        {mine && (
                          <div className="mt-3 flex items-center gap-2">
                            <Switch
                              id={`share-${n.id}`}
                              checked={!!n.shared_with_member}
                              disabled={share.isPending}
                              onCheckedChange={(v) => share.mutate({ id: n.id, shared: v })}
                            />
                            <Label htmlFor={`share-${n.id}`} className="text-xs text-muted-foreground">
                              Share with member
                            </Label>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {!isEditing && (
                    <div className="flex shrink-0 gap-1">
                      {mine && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setEditing({ id: n.id, body: n.body, shared: !!n.shared_with_member })
                          }
                          aria-label="Edit note"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {(mine || isAdmin) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setConfirmDelete(n)}
                          aria-label="Delete note"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>
              The note by {confirmDelete?.author?.display_name ?? confirmDelete?.author?.email ?? "this author"}{" "}
              will be removed permanently{confirmDelete?.shared_with_member ? ", including from the member's app" : ""}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete) del.mutate(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
