import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { AdFormDialog } from "@/components/ads/ad-form-dialog";
import {
  deletePlatformAd,
  getPlatformAdReport,
  listPlatformAds,
  setGymAdRevenueNote,
  setPlatformAdStatus,
  type AdRow,
  type AdStatus,
} from "@/lib/ads.functions";

export const Route = createFileRoute("/_authenticated/platform/ads")({
  head: () => ({
    meta: [
      { title: "Ad campaigns · Fit Foundry platform" },
      {
        name: "description",
        content:
          "Platform sponsor campaigns, reach across opted-in gyms, and addressable inventory.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlatformAdsPage,
});

const PLACEMENT_LABEL: Record<string, string> = {
  home_feed: "Member home",
  workout_complete: "After a workout",
  checkin_success: "After a check-in",
};
const STATUSES: AdStatus[] = ["draft", "active", "paused", "archived"];

function PlatformAdsPage() {
  const qc = useQueryClient();
  const fetchAds = useServerFn(listPlatformAds);
  const fetchReport = useServerFn(getPlatformAdReport);
  const changeStatus = useServerFn(setPlatformAdStatus);
  const removeAd = useServerFn(deletePlatformAd);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdRow | null>(null);

  const ads = useQuery({ queryKey: ["platform-ads"], queryFn: () => fetchAds() });
  const report = useQuery({ queryKey: ["platform-ad-report"], queryFn: () => fetchReport() });

  const statusMutation = useMutation({
    mutationFn: (v: { id: string; status: AdStatus }) => changeStatus({ data: v }),
    onSuccess: () => {
      toast.success("Status updated");
      void qc.invalidateQueries({ queryKey: ["platform-ads"] });
    },
    onError: (e: any) => toast.error("Couldn't change the status", { description: e?.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeAd({ data: { id } }),
    onSuccess: () => {
      toast.success("Campaign deleted");
      setPendingDelete(null);
      void qc.invalidateQueries({ queryKey: ["platform-ads"] });
    },
    onError: (e: any) => toast.error("Couldn't delete this campaign", { description: e?.message }),
  });

  const statsByAd = new Map((report.data?.campaigns ?? []).map((c) => [c.ad_id, c]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Ad campaigns</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Platform inventory that backfills empty slots in gyms that opted in.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" /> New campaign
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Campaigns</CardTitle>
          <Badge variant="outline">
            {report.data?.fill_enabled_gyms ?? 0} gyms accept platform fill
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {ads.isLoading ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : ads.isError ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              We couldn't load campaigns.{" "}
              <button className="underline" onClick={() => void ads.refetch()}>
                Try again
              </button>
            </div>
          ) : (ads.data ?? []).length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-semibold">No platform campaigns yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create one to fill unsold slots in opted-in gyms.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Advertiser</TableHead>
                    <TableHead>Headline</TableHead>
                    <TableHead>Placement</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Runs</TableHead>
                    <TableHead className="text-right">Gyms</TableHead>
                    <TableHead className="text-right">Impr.</TableHead>
                    <TableHead className="text-right">Clicks</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(ads.data ?? []).map((a) => {
                    const st = statsByAd.get(a.id);
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.advertiser_name}</TableCell>
                        <TableCell>
                          <button
                            className="text-left underline-offset-2 hover:underline"
                            onClick={() => {
                              setEditing(a);
                              setDialogOpen(true);
                            }}
                          >
                            {a.headline}
                          </button>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {PLACEMENT_LABEL[a.placement] ?? a.placement}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={a.status}
                            onValueChange={(v) =>
                              statusMutation.mutate({ id: a.id, status: v as AdStatus })
                            }
                          >
                            <SelectTrigger className="h-8 w-[120px] capitalize">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUSES.map((s) => (
                                <SelectItem key={s} value={s} className="capitalize">
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {a.starts_on} → {a.ends_on ?? "open"}
                        </TableCell>
                        <TableCell className="text-right font-numeric">
                          {st?.gyms_served ?? 0}
                        </TableCell>
                        <TableCell className="text-right font-numeric">
                          {st?.impressions ?? 0}
                        </TableCell>
                        <TableCell className="text-right font-numeric">{st?.clicks ?? 0}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${a.advertiser_name}`}
                            onClick={() => setPendingDelete(a)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <GymInventoryCard report={report} />

      <AdFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        scope="platform"
        ad={editing}
        onSaved={() => {
          void qc.invalidateQueries({ queryKey: ["platform-ads"] });
          void qc.invalidateQueries({ queryKey: ["platform-ad-report"] });
        }}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pendingDelete?.headline}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the {pendingDelete?.advertiser_name} campaign from every gym and deletes
              its daily counts. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function GymInventoryCard({ report }: { report: ReturnType<typeof useQuery<any>> }) {
  const qc = useQueryClient();
  const saveNote = useServerFn(setGymAdRevenueNote);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (v: { gymId: string; note: string }) => saveNote({ data: v }),
    onSuccess: () => {
      toast.success("Note saved");
      void qc.invalidateQueries({ queryKey: ["platform-ad-report"] });
    },
    onError: (e: any) => toast.error("Couldn't save the note", { description: e?.message }),
  });

  const gyms = (report.data?.gyms ?? []) as {
    gym_id: string;
    gym_name: string;
    slug: string;
    ads_enabled: boolean;
    allow_platform_fill: boolean;
    max_per_member_day: number;
    revenue_note: string | null;
    member_count: number;
  }[];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Addressable inventory</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {report.isLoading ? (
          <div className="space-y-2 p-5">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : report.isError ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            We couldn't load gym inventory.{" "}
            <button className="underline" onClick={() => void report.refetch()}>
              Try again
            </button>
          </div>
        ) : gyms.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No gyms yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gym</TableHead>
                  <TableHead className="text-right">Members</TableHead>
                  <TableHead>Ads on</TableHead>
                  <TableHead>Accepts fill</TableHead>
                  <TableHead className="text-right">Cap/day</TableHead>
                  <TableHead>Revenue note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gyms.map((g) => (
                  <TableRow key={g.gym_id}>
                    <TableCell className="font-medium">{g.gym_name}</TableCell>
                    <TableCell className="text-right font-numeric">{g.member_count}</TableCell>
                    <TableCell>
                      <Badge variant={g.ads_enabled ? "default" : "outline"}>
                        {g.ads_enabled ? "On" : "Off"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={g.allow_platform_fill ? "default" : "outline"}>
                        {g.allow_platform_fill ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-numeric">
                      {g.max_per_member_day}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Input
                          className="h-8 min-w-[180px]"
                          placeholder="e.g. 70/30 split, invoiced monthly"
                          value={notes[g.gym_id] ?? g.revenue_note ?? ""}
                          onChange={(e) => setNotes((n) => ({ ...n, [g.gym_id]: e.target.value }))}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={mutation.isPending}
                          onClick={() =>
                            mutation.mutate({
                              gymId: g.gym_id,
                              note: notes[g.gym_id] ?? g.revenue_note ?? "",
                            })
                          }
                        >
                          Save
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="p-4">
          <Badge variant="outline">Manually recorded — Fit Foundry does not process ad payments</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
