import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  deleteGymAd,
  getGymAdReport,
  getGymAdSettings,
  listGymAds,
  listPlatformAdsForGym,
  setAdStatus,
  setPlatformAdBlocked,
  updateGymAdSettings,
  type AdRow,
  type AdStatus,
} from "@/lib/ads.functions";

export const Route = createFileRoute("/_authenticated/admin/sponsors")({
  head: () => ({
    meta: [
      { title: "Sponsors · FitForge" },
      {
        name: "description",
        content: "Sell local sponsorships in your member app and track impressions and clicks.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SponsorsPage,
});

const PLACEMENT_LABEL: Record<string, string> = {
  home_feed: "Member home",
  workout_complete: "After a workout",
  checkin_success: "After a check-in",
};
const STATUSES: AdStatus[] = ["draft", "active", "paused", "archived"];

function SponsorsPage() {
  const qc = useQueryClient();
  const fetchSettings = useServerFn(getGymAdSettings);
  const saveSettings = useServerFn(updateGymAdSettings);
  const fetchAds = useServerFn(listGymAds);
  const fetchReport = useServerFn(getGymAdReport);
  const changeStatus = useServerFn(setAdStatus);
  const removeAd = useServerFn(deleteGymAd);

  const [editing, setEditing] = useState<AdRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AdRow | null>(null);

  const settings = useQuery({ queryKey: ["gym-ad-settings"], queryFn: () => fetchSettings() });
  const ads = useQuery({ queryKey: ["gym-ads"], queryFn: () => fetchAds() });
  const report = useQuery({ queryKey: ["gym-ad-report"], queryFn: () => fetchReport() });

  const settingsMutation = useMutation({
    mutationFn: (next: {
      adsEnabled: boolean;
      allowPlatformFill: boolean;
      maxPerMemberDay: number;
    }) => saveSettings({ data: next }),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: ["gym-ad-settings"] });
      const prev = qc.getQueryData(["gym-ad-settings"]);
      qc.setQueryData(["gym-ad-settings"], (old: any) =>
        old
          ? {
              ...old,
              ads_enabled: next.adsEnabled,
              allow_platform_fill: next.allowPlatformFill,
              max_per_member_day: next.maxPerMemberDay,
            }
          : old,
      );
      return { prev };
    },
    onError: (e: any, _v, ctx) => {
      qc.setQueryData(["gym-ad-settings"], ctx?.prev);
      toast.error("Couldn't save your ad settings", { description: e?.message });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["gym-ad-settings"] }),
  });

  const statusMutation = useMutation({
    mutationFn: (v: { id: string; status: AdStatus }) => changeStatus({ data: v }),
    onSuccess: () => {
      toast.success("Status updated");
      void qc.invalidateQueries({ queryKey: ["gym-ads"] });
    },
    onError: (e: any) => toast.error("Couldn't change the status", { description: e?.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeAd({ data: { id } }),
    onSuccess: () => {
      toast.success("Sponsor deleted");
      setPendingDelete(null);
      void qc.invalidateQueries({ queryKey: ["gym-ads"] });
    },
    onError: (e: any) => toast.error("Couldn't delete this sponsor", { description: e?.message }),
  });

  const s = settings.data;

  function patchSettings(
    patch: Partial<{
      adsEnabled: boolean;
      allowPlatformFill: boolean;
      maxPerMemberDay: number;
    }>,
  ) {
    if (!s) return;
    settingsMutation.mutate({
      adsEnabled: s.ads_enabled,
      allowPlatformFill: s.allow_platform_fill,
      maxPerMemberDay: s.max_per_member_day,
      ...patch,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Sponsors</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sell sponsorships to local businesses and show them in your member app.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" /> New sponsor
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {settings.isLoading ? (
            <Skeleton className="h-28 w-full" />
          ) : settings.isError ? (
            <div className="text-sm text-muted-foreground">
              We couldn't load your ad settings.{" "}
              <button className="underline" onClick={() => void settings.refetch()}>
                Try again
              </button>
            </div>
          ) : (
            s && (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Label className="text-sm font-semibold">Ads enabled</Label>
                    <p className="mt-1 max-w-xl text-xs text-muted-foreground">
                      Your members will start seeing sponsored cards. You keep 100% of what you
                      charge your sponsors — FitForge takes nothing and shares nothing with
                      advertisers.
                    </p>
                  </div>
                  <Switch
                    checked={s.ads_enabled}
                    onCheckedChange={(v) => patchSettings({ adsEnabled: v })}
                  />
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Label className="text-sm font-semibold">Let FitForge fill empty slots</Label>
                    <p className="mt-1 max-w-xl text-xs text-muted-foreground">
                      Only ever shows when you have no active ad of your own.
                    </p>
                  </div>
                  <Switch
                    checked={s.allow_platform_fill}
                    onCheckedChange={(v) => patchSettings({ allowPlatformFill: v })}
                  />
                </div>

                <div className="max-w-xs space-y-1.5">
                  <Label htmlFor="max-per-day">Max ads per member per day</Label>
                  <Input
                    id="max-per-day"
                    type="number"
                    min={0}
                    max={10}
                    value={s.max_per_member_day}
                    onChange={(e) =>
                      patchSettings({
                        maxPerMemberDay: Math.max(0, Math.min(10, Number(e.target.value) || 0)),
                      })
                    }
                  />
                </div>
              </>
            )
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">Your sponsors</TabsTrigger>
          {s?.allow_platform_fill && <TabsTrigger value="platform">Platform campaigns</TabsTrigger>}
        </TabsList>

        <TabsContent value="mine" className="mt-4 space-y-6">
          <Card>
            <CardContent className="p-0">
              {ads.isLoading ? (
                <div className="space-y-2 p-5">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : ads.isError ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  We couldn't load your sponsors.{" "}
                  <button className="underline" onClick={() => void ads.refetch()}>
                    Try again
                  </button>
                </div>
              ) : (ads.data ?? []).length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-sm font-semibold">No sponsors yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Add your first local sponsor to start earning.
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
                        <TableHead className="text-right">Impr.</TableHead>
                        <TableHead className="text-right">Clicks</TableHead>
                        <TableHead className="text-right">CTR</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(ads.data ?? []).map((a) => (
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
                                {STATUSES.map((st) => (
                                  <SelectItem key={st} value={st} className="capitalize">
                                    {st}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {a.starts_on} → {a.ends_on ?? "open"}
                          </TableCell>
                          <TableCell className="text-right font-numeric">{a.impressions}</TableCell>
                          <TableCell className="text-right font-numeric">{a.clicks}</TableCell>
                          <TableCell className="text-right font-numeric">
                            {a.ctr === null ? "—" : `${a.ctr}%`}
                          </TableCell>
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
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Last 30 days</CardTitle>
            </CardHeader>
            <CardContent>
              {report.isLoading ? (
                <Skeleton className="h-56 w-full" />
              ) : report.isError ? (
                <p className="text-sm text-muted-foreground">
                  We couldn't load your ad stats.{" "}
                  <button className="underline" onClick={() => void report.refetch()}>
                    Try again
                  </button>
                </p>
              ) : (report.data?.totals.impressions ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No impressions yet. Activate a sponsor to start counting.
                </p>
              ) : (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.data?.daily ?? []}>
                      <CartesianGrid stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="day"
                        stroke="var(--muted-foreground)"
                        fontSize={11}
                        tickFormatter={(d: string) => d.slice(5)}
                      />
                      <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                          color: "var(--foreground)",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="impressions" name="Impressions" fill="var(--primary)" />
                      <Bar dataKey="clicks" name="Clicks" fill="var(--secondary)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                Impressions and clicks are counted in daily totals. FitForge does not record which
                member saw which ad.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="platform" className="mt-4">
          <PlatformCampaignsTab />
        </TabsContent>
      </Tabs>

      <AdFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        scope="gym"
        ad={editing}
        onSaved={() => void qc.invalidateQueries({ queryKey: ["gym-ads"] })}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pendingDelete?.headline}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the sponsor from {pendingDelete?.advertiser_name} and its past daily
              counts. This cannot be undone.
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

function PlatformCampaignsTab() {
  const qc = useQueryClient();
  const fetchAds = useServerFn(listPlatformAdsForGym);
  const setBlocked = useServerFn(setPlatformAdBlocked);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["platform-ads-for-gym"],
    queryFn: () => fetchAds(),
  });

  const mutation = useMutation({
    mutationFn: (v: { adId: string; blocked: boolean }) => setBlocked({ data: v }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["platform-ads-for-gym"] }),
    onError: (e: any) => toast.error("Couldn't update this campaign", { description: e?.message }),
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (isError)
    return (
      <p className="text-sm text-muted-foreground">
        We couldn't load platform campaigns.{" "}
        <button className="underline" onClick={() => void refetch()}>
          Try again
        </button>
      </p>
    );
  if ((data ?? []).length === 0)
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <p className="text-sm font-semibold">No platform campaigns right now</p>
          <p className="mt-1 text-xs text-muted-foreground">
            When FitForge has inventory, it will appear here so you can block anything you don't
            want.
          </p>
        </CardContent>
      </Card>
    );

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Advertiser</TableHead>
                <TableHead>Headline</TableHead>
                <TableHead>Placement</TableHead>
                <TableHead>Runs</TableHead>
                <TableHead className="text-right">Blocked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.advertiser_name}</TableCell>
                  <TableCell>{a.headline}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {PLACEMENT_LABEL[a.placement] ?? a.placement}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {a.starts_on} → {a.ends_on ?? "open"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Switch
                      checked={a.blocked}
                      onCheckedChange={(v) => mutation.mutate({ adId: a.id, blocked: v })}
                      aria-label={`Block ${a.advertiser_name}`}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="p-4">
          <Badge variant="outline">Blocked campaigns never appear to your members</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
