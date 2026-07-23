import { useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { inviteMember, type MemberInput } from "@/lib/members.functions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { uploadMemberPhoto, signMemberPhotoForDisplay } from "@/lib/photo-upload";

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

const empty: MemberInput = {
  name: "",
  email: "",
  phone: "",
  goals: "",
  experience_level: "beginner",
  medical_history: "",
  photo_url: "",
  membership_type: "Monthly",
  membership_expires_at: "",
};

export function AddMemberDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const [form, setForm] = useState<MemberInput>(empty);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: (data: MemberInput) => inviteMember({ data }),
    onSuccess: () => {
      toast.success("Member invited", { description: `${form.name} will receive an email invitation.` });
      qc.invalidateQueries({ queryKey: ["members"] });
      setForm(empty);
      onOpenChange(false);
    },
    onError: (e: any) => toast.error("Could not invite member", { description: e?.message ?? "Unknown error" }),
  });

  function update<K extends keyof MemberInput>(k: K, v: MemberInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !me?.gymId) return;
    setUploading(true);
    try {
      const path = await uploadMemberPhoto(file, me.gymId);
      update("photo_url", path);
      setPreviewUrl(await signMemberPhotoForDisplay(path));
    } catch (err: any) {
      toast.error("Upload failed", { description: err?.message });
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add member</DialogTitle>
          <DialogDescription>Invite a new member. They'll receive an email to set up their account.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 md:grid-cols-2">
          <div className="md:col-span-2 flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-accent text-primary">
              {form.photo_url ? (
                <img src={form.photo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg font-semibold">{(form.name || "??").slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-input bg-background px-3 py-2 text-sm hover:bg-muted">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span>Upload photo</span>
              <input type="file" accept="image/*" className="hidden" onChange={onPhoto} disabled={uploading} />
            </label>
          </div>

          <div>
            <Label htmlFor="name">Full name *</Label>
            <Input id="name" value={form.name} onChange={(e) => update("name", e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="email">Email *</Label>
            <Input id="email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={form.phone ?? ""} onChange={(e) => update("phone", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="exp">Experience level</Label>
            <Select value={form.experience_level ?? "beginner"} onValueChange={(v) => update("experience_level", v as any)}>
              <SelectTrigger id="exp"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="mtype">Membership type</Label>
            <Input id="mtype" value={form.membership_type ?? ""} onChange={(e) => update("membership_type", e.target.value)} placeholder="Monthly, Annual…" />
          </div>
          <div>
            <Label htmlFor="exp-date">Membership expires</Label>
            <Input id="exp-date" type="date" value={form.membership_expires_at ?? ""} onChange={(e) => update("membership_expires_at", e.target.value)} />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="goals">Goals</Label>
            <Textarea id="goals" rows={2} value={form.goals ?? ""} onChange={(e) => update("goals", e.target.value)} placeholder="Lose 5kg, run a 10K…" />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="med">Medical history</Label>
            <Textarea id="med" rows={3} value={form.medical_history ?? ""} onChange={(e) => update("medical_history", e.target.value)} placeholder="Injuries, conditions, allergies…" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => mut.mutate(form)}
            disabled={!form.name || !form.email || mut.isPending}
          >
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
