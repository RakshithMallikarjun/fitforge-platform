import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Plus, Search, Upload, Users as UsersIcon, ArrowUpDown, MoreHorizontal, UserCog, UserX, UserCheck } from "lucide-react";
import { GlassHeader } from "@/components/glass-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { listMembers, listTrainers, setMemberActive } from "@/lib/members.functions";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-current-user";
import { AddMemberDialog } from "@/components/members/add-member-dialog";
import { BulkImportDialog } from "@/components/members/bulk-import-dialog";
import { AssignTrainersDialog } from "@/components/members/assign-trainers-dialog";
import { StatusBadge, getMembershipStatus, type MembershipStatus } from "@/components/members/status-badge";

export const Route = createFileRoute("/_authenticated/admin/members")({
  component: MembersPage,
});

type SortKey = "name" | "joined" | "last_login" | "status";

function MembersPage() {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const isAdmin = me?.roles.includes("admin");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | MembershipStatus>("all");
  const [trainerFilter, setTrainerFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [assignFor, setAssignFor] = useState<{ id: string; name: string; trainerIds: string[] } | null>(null);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["members"],
    queryFn: () => listMembers(),
  });
  const { data: trainers = [] } = useQuery({
    queryKey: ["trainers"],
    queryFn: () => listTrainers(),
  });

  const setActive = useMutation({
    mutationFn: (vars: { memberId: string; active: boolean }) => setMemberActive({ data: vars }),
    onSuccess: (_d, vars) => {
      toast.success(vars.active ? "Member reactivated" : "Member deactivated");
      qc.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (e: any) => toast.error("Action failed", { description: e?.message }),
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = (members as any[]).filter((m) => {
      const name = (m.display_name ?? m.email ?? "").toLowerCase();
      if (q && !name.includes(q) && !(m.email ?? "").toLowerCase().includes(q)) return false;
      const status = getMembershipStatus(m.active, m.profile?.membership_expires_at);
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (trainerFilter !== "all") {
        if (trainerFilter === "none" && m.trainers.length) return false;
        if (trainerFilter !== "none" && !m.trainers.some((t: any) => t.id === trainerFilter)) return false;
      }
      return true;
    });
    const cmp = (a: any, b: any) => {
      let av: any, bv: any;
      switch (sortKey) {
        case "joined": av = a.created_at; bv = b.created_at; break;
        case "last_login": av = a.last_sign_in_at ?? ""; bv = b.last_sign_in_at ?? ""; break;
        case "status": av = getMembershipStatus(a.active, a.profile?.membership_expires_at); bv = getMembershipStatus(b.active, b.profile?.membership_expires_at); break;
        default: av = (a.display_name ?? a.email ?? "").toLowerCase(); bv = (b.display_name ?? b.email ?? "").toLowerCase();
      }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    };
    return filtered.sort(cmp);
  }, [members, search, statusFilter, trainerFilter, sortKey, sortAsc]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortAsc((s) => !s);
    else { setSortKey(k); setSortAsc(true); }
  }

  return (
    <>
      <GlassHeader
        title="Members"
        subtitle={`${(members as any[]).length} ${(members as any[]).length === 1 ? "member" : "members"} in your gym`}
        initials={(me?.displayName ?? "FF").slice(0, 2).toUpperCase()}
        rightExtra={isAdmin ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setBulkOpen(true)}>
              <Upload className="mr-1.5 h-4 w-4" /> Import CSV
            </Button>
            <Button size="sm" className="rounded-lg" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Add member
            </Button>
          </div>
        ) : null}
      />

      <main className="mx-auto max-w-[1280px] space-y-6 px-8 py-8">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 min-w-[240px]">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expiring">Expiring soon</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select value={trainerFilter} onValueChange={setTrainerFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Trainer" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All trainers</SelectItem>
              <SelectItem value="none">Unassigned</SelectItem>
              {(trainers as any[]).map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.display_name ?? t.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
          {isLoading ? (
            <div className="grid place-items-center py-20 text-sm text-muted-foreground">Loading members…</div>
          ) : rows.length === 0 ? (
            <div className="grid place-items-center gap-2 py-20 text-sm text-muted-foreground">
              <UsersIcon className="h-6 w-6" />
              No members match your filters.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button className="inline-flex items-center gap-1" onClick={() => toggleSort("name")}>
                      Member <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button className="inline-flex items-center gap-1" onClick={() => toggleSort("status")}>
                      Status <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>Trainers</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>
                    <button className="inline-flex items-center gap-1" onClick={() => toggleSort("joined")}>
                      Joined <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button className="inline-flex items-center gap-1" onClick={() => toggleSort("last_login")}>
                      Last login <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((m: any) => {
                  const status = getMembershipStatus(m.active, m.profile?.membership_expires_at);
                  const initials = (m.display_name ?? m.email ?? "??").slice(0, 2).toUpperCase();
                  return (
                    <TableRow key={m.id}>
                      <TableCell>
                        <Link to="/admin/members/$memberId" params={{ memberId: m.id }} className="group flex items-center gap-3">
                          <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-accent text-xs font-semibold text-primary">
                            {m.photo_url ? <img src={m.photo_url} alt="" className="h-full w-full object-cover" /> : initials}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold group-hover:text-primary">{m.display_name ?? "—"}</p>
                            <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell><StatusBadge status={status} /></TableCell>
                      <TableCell>
                        {m.trainers.length === 0 ? (
                          <span className="text-xs text-muted-foreground">Unassigned</span>
                        ) : (
                          <div className="flex -space-x-2">
                            {m.trainers.slice(0, 3).map((t: any) => (
                              <div key={t.id} title={t.display_name ?? t.email} className="grid h-7 w-7 place-items-center rounded-full border-2 border-card bg-accent text-[10px] font-semibold text-primary">
                                {(t.display_name ?? t.email).slice(0, 2).toUpperCase()}
                              </div>
                            ))}
                            {m.trainers.length > 3 && (
                              <div className="grid h-7 w-7 place-items-center rounded-full border-2 border-card bg-muted text-[10px] font-semibold">
                                +{m.trainers.length - 3}
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {m.profile?.membership_expires_at ? (
                          <span className="text-foreground">{new Date(m.profile.membership_expires_at).toLocaleDateString()}</span>
                        ) : (
                          <span className="text-muted-foreground">No expiry</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.created_at ? new Date(m.created_at).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.last_sign_in_at ? formatDistanceToNow(new Date(m.last_sign_in_at), { addSuffix: true }) : "Never"}
                      </TableCell>
                      <TableCell>
                        {isAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger className="rounded-lg p-1.5 hover:bg-muted">
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setAssignFor({ id: m.id, name: m.display_name ?? m.email, trainerIds: m.trainers.map((t: any) => t.id) })}>
                                <UserCog className="mr-2 h-4 w-4" /> Assign trainers
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {m.active ? (
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setActive.mutate({ memberId: m.id, active: false })}
                                >
                                  <UserX className="mr-2 h-4 w-4" /> Deactivate
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => setActive.mutate({ memberId: m.id, active: true })}>
                                  <UserCheck className="mr-2 h-4 w-4" /> Reactivate
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </main>

      <AddMemberDialog open={addOpen} onOpenChange={setAddOpen} />
      <BulkImportDialog open={bulkOpen} onOpenChange={setBulkOpen} />
      {assignFor && (
        <AssignTrainersDialog
          open={!!assignFor}
          onOpenChange={(v) => { if (!v) setAssignFor(null); }}
          memberId={assignFor.id}
          memberName={assignFor.name}
          initialTrainerIds={assignFor.trainerIds}
        />
      )}
    </>
  );
}
