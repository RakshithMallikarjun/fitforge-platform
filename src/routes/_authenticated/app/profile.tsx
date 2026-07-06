import { useState, useEffect } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Check, LogOut, Mail, Pencil, Target, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { getMemberProfile, updateMyDisplayName } from "@/lib/profile.functions";
import { subscribePush, unsubscribePush, getPushStatus } from "@/lib/push.functions";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export const Route = createFileRoute("/_authenticated/app/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["member-profile"],
    queryFn: () => getMemberProfile(),
  });

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  useEffect(() => {
    if (data?.displayName) setName(data.displayName);
  }, [data?.displayName]);

  const updateName = useMutation({
    mutationFn: (displayName: string) => updateMyDisplayName({ data: { displayName } }),
    onSuccess: () => {
      toast.success("Name updated");
      qc.invalidateQueries({ queryKey: ["member-profile"] });
      qc.invalidateQueries({ queryKey: ["current-user"] });
      setEditing(false);
    },
    onError: (e: any) => toast.error("Could not update", { description: e?.message }),
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-44 rounded-[2rem]" />
        <Skeleton className="h-28 rounded-[2rem]" />
        <Skeleton className="h-12 rounded-xl" />
      </div>
    );
  }

  const initials = (data.displayName ?? data.email ?? "FF").slice(0, 2).toUpperCase();
  const assessment = data.latestAssessment;

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold tracking-tight">Profile</h1>

      <div className="rounded-[2rem] border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
        <div className="mx-auto grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-accent text-lg font-semibold text-primary">
          {data.photoUrl ? (
            <img src={data.photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </div>

        {editing ? (
          <div className="mx-auto mt-4 flex max-w-xs items-center gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" />
            <Button
              size="icon"
              className="rounded-xl"
              disabled={updateName.isPending || !name.trim()}
              onClick={() => updateName.mutate(name.trim())}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setEditing(false);
                setName(data.displayName ?? "");
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-3 inline-flex items-center gap-1.5 text-base font-semibold tracking-tight hover:text-primary"
          >
            {data.displayName ?? "Member"}
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
        <p className="mt-0.5 inline-flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <Mail className="h-3 w-3" />
          {data.email}
        </p>
      </div>

      <div className="rounded-[2rem] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold tracking-tight">Latest assessment</p>
          {assessment && (
            <p className="text-xs text-muted-foreground">
              {new Date(assessment.date).toLocaleDateString()}
            </p>
          )}
        </div>
        {assessment ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-background p-3">
              <p className="text-xs text-muted-foreground">Weight</p>
              <p className="mt-1 font-numeric text-xl font-bold tracking-tight">
                {assessment.weight ?? "—"}
                <span className="ml-1 text-xs text-muted-foreground">kg</span>
              </p>
            </div>
            <div className="rounded-2xl bg-background p-3">
              <p className="text-xs text-muted-foreground">Body fat</p>
              <p className="mt-1 font-numeric text-xl font-bold tracking-tight">
                {assessment.bodyFatPct ?? "—"}
                <span className="ml-1 text-xs text-muted-foreground">%</span>
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">No assessment recorded yet.</p>
        )}
      </div>

      <PushNotificationsSection />

      <Link
        to="/app/progress"
        search={{ tab: "goals" } as never}
        className="card-lift flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
      >
        <div className="grid h-10 w-10 place-items-center rounded-full bg-primary-soft text-primary">
          <Target className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">My goals</p>
          <p className="text-xs text-muted-foreground">Track your targets and progress</p>
        </div>
      </Link>

      <Button variant="outline" className="w-full rounded-xl" onClick={signOut}>
        <LogOut className="mr-2 h-4 w-4" />
        Sign out
      </Button>
    </div>
  );
}


