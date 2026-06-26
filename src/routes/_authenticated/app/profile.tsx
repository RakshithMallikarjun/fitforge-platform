import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Mail, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold tracking-tight">Profile</h1>

      <div className="rounded-[2rem] border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent text-primary">
          <UserIcon className="h-7 w-7" />
        </div>
        <p className="mt-3 text-base font-semibold tracking-tight">
          {user?.displayName ?? "Member"}
        </p>
        <p className="mt-0.5 inline-flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <Mail className="h-3 w-3" />
          {user?.email}
        </p>
      </div>

      <Button variant="outline" className="w-full rounded-xl" onClick={signOut}>
        <LogOut className="mr-2 h-4 w-4" />
        Sign out
      </Button>
    </div>
  );
}
