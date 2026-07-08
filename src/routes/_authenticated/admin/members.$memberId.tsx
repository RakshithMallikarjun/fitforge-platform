import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Calendar, ClipboardList, FileText, Mail, MessageSquare, Phone, StickyNote, User, UserCog, UserCheck, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { GlassHeader } from "@/components/glass-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMember } from "@/lib/members.functions";
import { logAttendanceManual } from "@/lib/checkin.functions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { AssignTrainersDialog } from "@/components/members/assign-trainers-dialog";
import { EditMembershipDialog } from "@/components/members/edit-membership-dialog";
import { StatusBadge, getMembershipStatus } from "@/components/members/status-badge";
import { MemberNotes } from "@/components/members/member-notes";
import { AssessmentsTab } from "@/components/assessments/assessments-tab";
import { AttendanceHeatmap } from "@/components/members/attendance-heatmap";
import { ThreadView } from "@/components/messages/thread-view";

export const Route = createFileRoute("/_authenticated/admin/members/$memberId")({
  component: MemberProfile,
});

function MemberProfile() {
  const { memberId } = Route.useParams();
  const { data: me } = useCurrentUser();
  const isAdmin = me?.roles.includes("admin");
  const [assignOpen, setAssignOpen] = useState(false);
  const [membershipOpen, setMembershipOpen] = useState(false);
  const qc = useQueryClient();
  const logManual = useServerFn(logAttendanceManual);

  const { data, isLoading, error } = useQuery({
    queryKey: ["member", memberId],
    queryFn: () => getMember({ data: { memberId } }),
  });

  const manualCheckin = useMutation({
    mutationFn: () => logManual({ data: { memberId } }),
    onSuccess: () => {
      toast.success("Check-in logged");
      qc.invalidateQueries({ queryKey: ["member", memberId] });
    },
    onError: (e: any) => toast.error("Could not log check-in", { description: e?.message }),
  });

  if (isLoading) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (error || !data?.user) {
    return (
      <div className="grid min-h-[60vh] place-items-center gap-3 text-sm text-muted-foreground">
        <p>Couldn't load this member.</p>
        <Link to="/admin/members" className="text-primary hover:underline">← Back to members</Link>
      </div>
    );
  }

  const { user, profile, trainers, assessments, plans, attendance } = data;
  const status = getMembershipStatus(user.active, profile?.membership_expires_at);
  const initials = (user.display_name ?? user.email ?? "??").slice(0, 2).toUpperCase();

  return (
    <>
      <GlassHeader
        title={user.display_name ?? user.email}
        subtitle={user.email}
        initials={initials}
      />

      <main className="mx-auto max-w-[1280px] space-y-6 px-8 py-8">
        <Link to="/admin/members" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All members
        </Link>

        {/* Header card */}
        <div className="flex flex-wrap items-start gap-6 rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl bg-accent text-xl font-bold text-primary">
            {user.photo_url ? <img src={user.photo_url} alt="" className="h-full w-full object-cover" /> : initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold tracking-tight">{user.display_name ?? "—"}</h2>
              <StatusBadge status={status} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {user.email}</span>
              {user.phone && <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {user.phone}</span>}
              <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Joined {new Date(user.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setMembershipOpen(true)}>
                <CreditCard className="mr-1.5 h-4 w-4" /> Edit membership
              </Button>
              <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setAssignOpen(true)}>
                <UserCog className="mr-1.5 h-4 w-4" /> Assign trainers
              </Button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="rounded-xl">
            <TabsTrigger value="overview"><User className="mr-1.5 h-4 w-4" /> Overview</TabsTrigger>
            <TabsTrigger value="assessments"><FileText className="mr-1.5 h-4 w-4" /> Assessments</TabsTrigger>
            <TabsTrigger value="plans"><ClipboardList className="mr-1.5 h-4 w-4" /> Workout plans</TabsTrigger>
            <TabsTrigger value="attendance"><Calendar className="mr-1.5 h-4 w-4" /> Attendance</TabsTrigger>
            <TabsTrigger value="messages"><MessageSquare className="mr-1.5 h-4 w-4" /> Messages</TabsTrigger>
            <TabsTrigger value="notes"><StickyNote className="mr-1.5 h-4 w-4" /> Notes</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <InfoCard title="Demographics" rows={[
                ["Date of birth", profile?.dob ? new Date(profile.dob).toLocaleDateString() : "—"],
                ["Gender", profile?.gender ?? "—"],
                ["Experience", profile?.experience_level ?? "—"],
              ]} />
              <InfoCard title="Membership" rows={[
                ["Plan", profile?.membership_type ?? "—"],
                ["Expires", profile?.membership_expires_at ? new Date(profile.membership_expires_at).toLocaleDateString() : "—"],
                ["Status", <StatusBadge key="s" status={status} />],
              ]} />
              <InfoCard title="Contact" rows={[
                ["Email", user.email],
                ["Phone", user.phone ?? "—"],
              ]} />
              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="text-sm font-semibold tracking-tight">Assigned trainers</h3>
                {trainers.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">No trainers assigned yet.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {trainers.map((t: any) => (
                      <li key={t.id} className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-accent text-xs font-semibold text-primary">
                          {t.photo_url ? <img src={t.photo_url} alt="" className="h-full w-full object-cover" /> : (t.display_name ?? t.email).slice(0,2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{t.display_name ?? t.email}</p>
                          <p className="truncate text-xs text-muted-foreground">{t.email}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {profile?.goals && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="text-sm font-semibold tracking-tight">Goals</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{profile.goals}</p>
              </div>
            )}
            {profile?.health_notes && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="text-sm font-semibold tracking-tight">Medical history</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{profile.health_notes}</p>
              </div>
            )}
          </TabsContent>

          {/* ASSESSMENTS */}
          <TabsContent value="assessments">
            <AssessmentsTab memberId={memberId} />
          </TabsContent>


          {/* PLANS */}
          <TabsContent value="plans" className="space-y-3">
            <div className="flex justify-end">
              <Link
                to="/admin/plans/new"
                search={{ memberId }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <ClipboardList className="h-4 w-4" /> New plan for this member
              </Link>
            </div>
            <EmptyOrList
              items={plans}
              emptyIcon={<ClipboardList className="h-6 w-6" />}
              emptyText="No workout plans assigned yet."
              render={(p: any) => (
                <li key={p.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.name ?? p.title ?? "Untitled plan"}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {p.start_date ? `Starts ${new Date(p.start_date).toLocaleDateString()}` : "No start date"}
                      {p.status ? ` · ${p.status}` : ""}
                    </p>
                  </div>
                  <Link to="/admin/plans/$planId" params={{ planId: p.id }} className="text-sm font-medium text-primary hover:underline">View</Link>
                </li>
              )}
            />
          </TabsContent>

          {/* ATTENDANCE */}
          <TabsContent value="attendance" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-tight">Last 12 weeks</h3>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => manualCheckin.mutate()}
                disabled={manualCheckin.isPending}
              >
                <UserCheck className="h-4 w-4" /> Log attendance
              </Button>
            </div>
            <AttendanceHeatmap entries={attendance ?? []} />
            <EmptyOrList
              items={attendance}
              emptyIcon={<Calendar className="h-6 w-6" />}
              emptyText="No check-ins yet."
              render={(a: any) => (
                <li key={a.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
                  <div>
                    <p className="text-sm font-semibold">{new Date(a.check_in_at).toLocaleString()}</p>
                    {a.check_out_at && (
                      <p className="text-xs text-muted-foreground">Checked out {new Date(a.check_out_at).toLocaleTimeString()}</p>
                    )}
                  </div>
                </li>
              )}
            />
          </TabsContent>

          {/* MESSAGES */}
          <TabsContent value="messages">
            <div className="rounded-2xl border border-border bg-card p-2">
              <ThreadView otherUserId={memberId} />
            </div>
          </TabsContent>

          {/* NOTES */}
          <TabsContent value="notes">
            <MemberNotes memberId={memberId} />
          </TabsContent>
        </Tabs>
      </main>

      {isAdmin && (
        <>
          <AssignTrainersDialog
            open={assignOpen}
            onOpenChange={setAssignOpen}
            memberId={memberId}
            memberName={user.display_name ?? user.email}
            initialTrainerIds={trainers.map((t: any) => t.id)}
          />
          <EditMembershipDialog
            open={membershipOpen}
            onOpenChange={setMembershipOpen}
            memberId={memberId}
            currentType={profile?.membership_type ?? null}
            currentExpiresAt={profile?.membership_expires_at ?? null}
          />
        </>
      )}
    </>
  );
}

function InfoCard({ title, rows }: { title: string; rows: [string, React.ReactNode][] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      <dl className="mt-3 space-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function EmptyOrList<T>({ items, emptyIcon, emptyText, render }: { items: T[]; emptyIcon: React.ReactNode; emptyText: string; render: (item: T) => React.ReactNode }) {
  if (!items.length) {
    return (
      <div className="grid place-items-center gap-2 rounded-2xl border border-dashed border-border py-12 text-sm text-muted-foreground">
        {emptyIcon}
        {emptyText}
      </div>
    );
  }
  return <ul className="space-y-2">{items.map(render)}</ul>;
}
