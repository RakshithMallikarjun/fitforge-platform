import { consolePageHead } from "@/lib/page-head";
import { ContactByEmail } from "@/components/contact-by-email";
import { useCurrentUser } from "@/hooks/use-current-user";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, ErrorState, relTime } from "@/components/platform/platform-ui";
import { MEMBER_COUNT_OPTIONS, listLeads, setLeadStatus, type Lead } from "@/lib/leads.functions";
import { formatServerError } from "@/lib/format-error";

export const Route = createFileRoute("/_authenticated/platform/leads")({
  head: () =>
    consolePageHead("Platform leads", "Platform leads and records in your Fit Foundry account."),
  component: PlatformLeadsPage,
});

const STATUS_LABEL = { new: "New", contacted: "Contacted", converted: "Converted" } as const;

function PlatformLeadsPage() {
  const { data: sender } = useCurrentUser();
  const qc = useQueryClient();
  const fetchLeads = useServerFn(listLeads);
  const updateFn = useServerFn(setLeadStatus);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["platform-leads"],
    queryFn: () => fetchLeads(),
  });

  const update = useMutation({
    mutationFn: (v: { id: string; status: Lead["status"] }) => updateFn({ data: v }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ["platform-leads"] });
      const prev = qc.getQueryData<Lead[]>(["platform-leads"]);
      qc.setQueryData<Lead[]>(["platform-leads"], (rows) =>
        (rows ?? []).map((r) => (r.id === v.id ? { ...r, status: v.status } : r)),
      );
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["platform-leads"], ctx.prev);
      toast.error("Couldn't update the lead", { description: formatServerError(e) });
    },
  });

  return (
    <main className="mx-auto max-w-[1200px] space-y-5 px-6 py-8">
      <header>
        <h1 className="text-lg font-bold tracking-tight">Leads</h1>
        <p className="text-xs text-muted-foreground">Gym owners who asked to get started.</p>
      </header>
      {isError ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      ) : !data?.length ? (
        <EmptyState>No leads yet.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Received</TableHead>
                <TableHead>Gym</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {relTime(l.created_at)}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{l.gym_name}</p>
                    <p className="text-xs text-muted-foreground">{l.city}</p>
                  </TableCell>
                  <TableCell className="text-sm">
                    <ContactByEmail
                      to={l.email}
                      recipientName={l.contact_name}
                      subject={`Fit Foundry for ${l.gym_name}`}
                      body={`Hi ${l.contact_name},\n\nThanks for your interest in Fit Foundry for ${l.gym_name}. When would be a good time to talk?\n\n${sender?.displayName ?? sender?.email ?? ""}`}
                    />
                    <a href={`tel:${l.phone}`} className="block text-xs hover:underline">
                      {l.phone}
                    </a>
                  </TableCell>
                  <TableCell className="text-sm">
                    {MEMBER_COUNT_OPTIONS.find((o) => o.value === l.member_count)?.label ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={l.status}
                      onValueChange={(v) =>
                        update.mutate({ id: l.id, status: v as Lead["status"] })
                      }
                    >
                      <SelectTrigger className="w-36" aria-label={`Status for ${l.gym_name}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_LABEL) as Lead["status"][]).map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </main>
  );
}
