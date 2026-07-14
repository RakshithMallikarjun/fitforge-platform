import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ShieldCheck, UserCog, MoreHorizontal, UserX, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { GlassHeader } from "@/components/glass-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { inviteStaffMember, listStaff, setStaffActive } from "@/lib/staff.functions";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/admin/staff")({
  component: StaffPage,
});

function StaffPage() {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const isAdmin = me?.roles.includes("admin");
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"admin" | "trainer">("trainer");

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: () => listStaff(),
    enabled: !!isAdmin,
  });

  const invite = useMutation({
    mutationFn: () => inviteStaffMember({ data: { email, displayName, role } }),
    onSuccess: () => {
      toast.success("Invite sent");
      qc.invalidateQueries({ queryKey: ["staff"] });
      setOpen(false);
      setEmail("");
      setDisplayName("");
      setRole("trainer");
    },
    onError: (e: any) => toast.error("Invite failed", { description: e?.message }),
  });

  const [deactivateTarget, setDeactivateTarget] = useState<{ id: string; name: string } | null>(null);
  const setActive = useMutation({
    mutationFn: (vars: { userId: string; active: boolean }) => setStaffActive({ data: vars }),
    onSuccess: (_d, vars) => {
      toast.success(vars.active ? "Staff reactivated" : "Staff deactivated");
      qc.invalidateQueries({ queryKey: ["staff"] });
      setDeactivateTarget(null);
    },
    onError: (e: any) => toast.error("Action failed", { description: e?.message }),
  });

  if (!isAdmin) {
    return (
      <main className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground">
        Admin access required.
      </main>
    );
  }

  return (
    <>
      <GlassHeader
        title="Staff"
        subtitle={`${(staff as any[]).length} ${(staff as any[]).length === 1 ? "person" : "people"} on your team`}
        initials={(me?.displayName ?? "FF").slice(0, 2).toUpperCase()}
        rightExtra={
          <Button size="sm" className="rounded-lg" onClick={() => setOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Invite staff
          </Button>
        }
      />
      <main className="mx-auto max-w-[1280px] space-y-6 px-8 py-8">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
          {isLoading ? (
            <div className="grid place-items-center py-20 text-sm text-muted-foreground">Loading…</div>
          ) : (staff as any[]).length === 0 ? (
            <div className="grid place-items-center gap-2 py-20 text-sm text-muted-foreground">
              <UserCog className="h-6 w-6" /> No staff yet — invite your first trainer.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(staff as any[]).map((u) => {
                  const isSelf = u.id === me?.userId;
                  return (
                    <TableRow key={u.id} className={u.active === false ? "opacity-60" : undefined}>
                      <TableCell className="font-medium">{u.display_name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {u.roles.map((r: string) => (
                            <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>
                              {r === "admin" && <ShieldCheck className="mr-1 h-3 w-3" />}
                              {r}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.active === false ? (
                          <Badge variant="outline" className="border-destructive/40 text-destructive">Inactive</Badge>
                        ) : (
                          <Badge variant="secondary">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell>
                        {!isSelf && (
                          <DropdownMenu>
                            <DropdownMenuTrigger className="rounded-lg p-1.5 hover:bg-muted">
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {u.active === false ? (
                                <DropdownMenuItem onClick={() => setActive.mutate({ userId: u.id, active: true })}>
                                  <UserCheck className="mr-2 h-4 w-4" /> Reactivate
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeactivateTarget({ id: u.id, name: u.display_name ?? u.email })}
                                >
                                  <UserX className="mr-2 h-4 w-4" /> Deactivate
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite staff member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="staff-name">Full name</Label>
              <Input id="staff-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-email">Email</Label>
              <Input id="staff-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trainer">Trainer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => invite.mutate()}
              disabled={invite.isPending || !email || !displayName}
            >
              {invite.isPending ? "Sending…" : "Send invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deactivateTarget} onOpenChange={(v) => !v && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {deactivateTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will no longer be able to log in until reactivated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deactivateTarget && setActive.mutate({ userId: deactivateTarget.id, active: false })}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
