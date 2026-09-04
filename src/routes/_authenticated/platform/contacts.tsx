import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CopyButton, EmptyState, ErrorState, relTime } from "@/components/platform/platform-ui";
import { listPlatformGymAdmins } from "@/lib/platform.functions";

export const Route = createFileRoute("/_authenticated/platform/contacts")({
  component: PlatformContactsPage,
});

function PlatformContactsPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["platform-gym-admins"],
    queryFn: () => listPlatformGymAdmins(),
  });

  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [state, setState] = useState("all");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((r) => {
      if (role !== "all" && r.role !== role) return false;
      if (state === "enabled" && !r.is_enabled) return false;
      if (state === "disabled" && r.is_enabled) return false;
      if (!q) return true;
      return [r.gym_name, r.gym_slug, r.display_name ?? "", r.email, r.phone ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [data, search, role, state]);

  return (
    <main className="mx-auto max-w-[1200px] space-y-5 px-6 py-8">
      <header>
        <h1 className="text-lg font-bold tracking-tight">Gym contacts</h1>
        <p className="text-xs text-muted-foreground">
          Admin and trainer contact details only — member records are never exposed here.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search gym, name, email or phone…"
          className="w-72"
        />
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
            <SelectItem value="trainer">Trainers</SelectItem>
          </SelectContent>
        </Select>
        <Select value={state} onValueChange={setState}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All gyms</SelectItem>
            <SelectItem value="enabled">Enabled gyms</SelectItem>
            <SelectItem value="disabled">Disabled gyms</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isError ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState>No contacts match these filters.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Gym</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Last sign-in</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={`${r.gym_id}-${r.user_id}-${r.role}`}>
                  <TableCell>
                    <Link
                      to="/platform/gyms/$gymId"
                      params={{ gymId: r.gym_id }}
                      className="font-medium hover:underline"
                    >
                      {r.gym_name}
                    </Link>
                    {!r.is_enabled && (
                      <Badge variant="destructive" className="ml-2">Disabled</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.display_name ?? "—"}
                    {!r.active && <Badge variant="secondary" className="ml-2">Inactive</Badge>}
                  </TableCell>
                  <TableCell className="capitalize text-sm">{r.role}</TableCell>
                  <TableCell className="text-sm">
                    <span className="inline-flex items-center gap-1">
                      <a href={`mailto:${r.email}`} className="hover:underline">{r.email}</a>
                      <CopyButton value={r.email} />
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.phone ? (
                      <span className="inline-flex items-center gap-1">
                        <a href={`tel:${r.phone}`} className="hover:underline">{r.phone}</a>
                        <CopyButton value={r.phone} />
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{relTime(r.last_sign_in_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </main>
  );
}
