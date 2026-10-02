import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { listMemberProfileHistory, updateMemberProfile } from "@/lib/members.functions";
import { formatServerError } from "@/lib/format-error";

const FIELD_LABEL: Record<string, string> = {
  name: "name",
  phone: "phone",
  date_of_birth: "date of birth",
  gender: "gender",
  experience_level: "experience level",
  goals: "goals",
  medical_history: "medical history",
};

export function EditProfileDialog({
  memberId,
  user,
  profile,
  open,
  onOpenChange,
}: {
  memberId: string;
  user: any;
  profile: any;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: "",
    phone: "",
    dob: "",
    gender: "",
    experienceLevel: "",
    goals: "",
    medicalHistory: "",
  });

  useEffect(() => {
    if (!open) return;
    setF({
      name: user?.display_name ?? "",
      phone: user?.phone ?? "",
      dob: profile?.dob ?? "",
      gender: profile?.gender ?? "",
      experienceLevel: profile?.experience_level ?? "",
      goals: profile?.goals ?? "",
      medicalHistory: profile?.health_notes ?? profile?.medical_history ?? "",
    });
  }, [open, user, profile]);

  const history = useQuery({
    enabled: open,
    queryKey: ["member-profile-history", memberId],
    queryFn: () => listMemberProfileHistory({ data: { memberId } }),
  });

  const save = useMutation({
    mutationFn: () => updateMemberProfile({ data: { memberId, ...f } }),
    onSuccess: (r) => {
      toast.success(r?.changed ? "Profile updated" : "No changes to save");
      qc.invalidateQueries({ queryKey: ["member", memberId] });
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["member-profile-history", memberId] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error("Couldn't update the profile", { description: formatServerError(e) }),
  });

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>Changes are recorded in this member's history.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ep-name">Name</Label>
            <Input id="ep-name" value={f.name} onChange={set("name")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ep-phone">Phone</Label>
              <Input id="ep-phone" value={f.phone} onChange={set("phone")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ep-dob">Date of birth</Label>
              <Input id="ep-dob" type="date" min="1900-01-01" max={new Date().toISOString().slice(0, 10)} value={f.dob} onChange={set("dob")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ep-gender">Gender</Label>
              <Input id="ep-gender" value={f.gender} onChange={set("gender")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ep-exp">Experience level</Label>
              <Input
                id="ep-exp"
                value={f.experienceLevel}
                onChange={set("experienceLevel")}
                placeholder="beginner / intermediate / advanced"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ep-goals">Goals</Label>
            <Textarea id="ep-goals" rows={2} value={f.goals} onChange={set("goals")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ep-med">Medical history</Label>
            <Textarea id="ep-med" rows={3} value={f.medicalHistory} onChange={set("medicalHistory")} />
          </div>

          <div className="rounded-xl border border-border p-3">
            <p className="text-xs font-semibold">Recent changes</p>
            {history.isLoading ? (
              <p className="mt-1 text-xs text-muted-foreground">Loading…</p>
            ) : history.error ? (
              <p className="mt-1 text-xs text-destructive">Couldn't load the history.</p>
            ) : (history.data ?? []).length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">No edits yet.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                {history.data!.map((h) => (
                  <li key={h.id}>
                    {h.by ?? "Someone"} changed {h.fields.map((k) => FIELD_LABEL[k] ?? k).join(", ")}{" "}
                    {formatDistanceToNow(new Date(h.created_at), { addSuffix: true })}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!f.name.trim() || save.isPending} onClick={() => save.mutate()}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
