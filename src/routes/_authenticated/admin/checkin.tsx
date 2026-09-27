import { useEffect, useRef, useState } from "react";
import { formatServerError } from "@/lib/format-error";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, ScanLine, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { GlassHeader } from "@/components/glass-header";
import { Button } from "@/components/ui/button";
import {
  listRecentCheckins,
  logAttendanceManual,
  searchMembersForCheckin,
  verifyAndCheckin,
} from "@/lib/checkin.functions";
import { formatTime } from "@/lib/format-date";

export const Route = createFileRoute("/_authenticated/admin/checkin")({
  component: AdminCheckin,
});

type RecentScan = {
  at: number;
  ok: boolean;
  message: string;
};

function AdminCheckin() {
  const verify = useServerFn(verifyAndCheckin);
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<any>(null);
  const [scanning, setScanning] = useState(false);
  const [recent, setRecent] = useState<RecentScan[]>([]);
  const busyRef = useRef(false);
  const lastTokenRef = useRef<{ token: string; at: number } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [noCamera, setNoCamera] = useState(false);
  const qc = useQueryClient();
  const recentFn = useServerFn(listRecentCheckins);
  const recentQ = useQuery({
    queryKey: ["front-desk-recent"],
    queryFn: () => recentFn(),
    refetchInterval: 30_000,
    retry: 1,
  });
  const refreshRecent = () => void qc.invalidateQueries({ queryKey: ["front-desk-recent"] });

  async function start() {
    if (scanning) return;
    const mod = await import("html5-qrcode");
    const { Html5Qrcode } = mod;
    const id = "fitfoundry-qr-reader";
    if (!containerRef.current) return;
    containerRef.current.id = id;
    const scanner = new Html5Qrcode(id);
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        async (decodedText: string) => {
          // Dedupe scans within 3s
          const now = Date.now();
          if (
            lastTokenRef.current &&
            lastTokenRef.current.token === decodedText &&
            now - lastTokenRef.current.at < 3000
          ) {
            return;
          }
          lastTokenRef.current = { token: decodedText, at: now };
          if (busyRef.current) return;
          busyRef.current = true;
          try {
            const r: any = await verify({ data: { token: decodedText } });
            const name = r.member?.display_name ?? r.member?.email ?? "Member";
            const msg = r.upgradedFromHome
              ? `Checked in ${name} — switched today's home session to a gym visit`
              : r.alreadyCheckedIn
                ? `${name} already checked in today`
                : `Checked in ${name}`;
            setRecent((cur) => [{ at: now, ok: true, message: msg }, ...cur].slice(0, 10));
            toast.success(msg);
            refreshRecent();
          } catch (e: any) {
            setRecent((cur) =>
              [{ at: now, ok: false, message: formatServerError(e) }, ...cur].slice(0, 10),
            );
            toast.error("Check-in failed", { description: formatServerError(e) });
          } finally {
            busyRef.current = false;
          }
        },
        () => {}, // ignore scan errors
      );
      setScanning(true);
    } catch (e: any) {
      scannerRef.current = null;
      setNoCamera(true);
      toast.error("Could not start camera", {
        description: "No camera available — search for the member instead",
      });
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }

  async function stop() {
    const s = scannerRef.current;
    if (!s) return;
    try {
      await s.stop();
      await s.clear();
    } catch {
      /* ignore */
    }
    scannerRef.current = null;
    setScanning(false);
  }

  useEffect(
    () => () => {
      void stop();
    },
    [],
  );

  return (
    <>
      <GlassHeader title="Front desk check-in" subtitle="Scan a member's QR code" />
      <main className="mx-auto max-w-3xl space-y-6 px-8 py-8">
        <div className="rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <div
            ref={containerRef}
            className="mx-auto aspect-square w-full max-w-md overflow-hidden rounded-2xl bg-black/90"
          />
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {scanning
                ? "Point the camera at a member's QR code."
                : "Tap start to activate the camera."}
            </p>
            {scanning ? (
              <Button variant="outline" size="sm" className="rounded-xl" onClick={stop}>
                Stop
              </Button>
            ) : (
              <Button size="sm" className="rounded-xl" onClick={start}>
                <ScanLine className="mr-1.5 h-4 w-4" /> Start scanner
              </Button>
            )}
          </div>
        </div>

        <FindMember inputRef={searchRef} noCamera={noCamera} onCheckedIn={refreshRecent} />

        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold tracking-tight">Recent check-ins</h3>
          {recent.some((r) => !r.ok) && (
            <ul className="mt-3 space-y-1 text-xs">
              {recent
                .filter((r) => !r.ok)
                .map((r) => (
                  <li key={r.at} className="flex items-center gap-2 text-destructive">
                    <XCircle className="h-3.5 w-3.5" />
                    {formatTime(r.at)} — {r.message}
                  </li>
                ))}
            </ul>
          )}
          {recentQ.isLoading ? (
            <div className="mt-3 space-y-2">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-3/4" />
            </div>
          ) : recentQ.isError ? (
            <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
              Couldn't load today's check-ins.
              <Button size="sm" variant="outline" onClick={() => recentQ.refetch()}>
                Retry
              </Button>
            </div>
          ) : (recentQ.data?.checkins.length ?? 0) === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No check-ins yet today.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {(recentQ.data?.checkins ?? []).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">{formatTime(r.at)}</span>
                  <span className="font-medium">{r.member}</span>
                  <span className="text-xs text-muted-foreground">· {r.recordedBy}</span>
                  <span className="ml-auto inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {r.location === "home" ? "Home" : "Gym"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}

const STATUS_LABEL = {
  active: "Active",
  expiring: "Expiring soon",
  expired: "Expired",
  none: "No membership",
} as const;

function FindMember({
  inputRef,
  noCamera,
  onCheckedIn,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  noCamera: boolean;
  onCheckedIn: () => void;
}) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const searchFn = useServerFn(searchMembersForCheckin);
  const manualFn = useServerFn(logAttendanceManual);
  const results = useQuery({
    queryKey: ["front-desk-search", debounced],
    queryFn: () => searchFn({ data: { q: debounced } }),
    enabled: debounced.length >= 2,
    retry: false,
  });
  const checkIn = useMutation({
    mutationFn: (m: { id: string; name: string }) =>
      manualFn({ data: { memberId: m.id } }).then((r) => ({ ...r, name: m.name })),
    onSuccess: (r) => {
      toast.success(
        r.alreadyCheckedIn ? `${r.name} already checked in today` : `Checked in ${r.name}`,
      );
      onCheckedIn();
    },
    onError: (e) => toast.error("Could not check in", { description: formatServerError(e) }),
  });

  const members = results.data?.members ?? [];
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold tracking-tight">Find member</h3>
      {noCamera && (
        <p className="mt-1 text-xs text-muted-foreground">
          No camera available — search for the member instead
        </p>
      )}
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name, email or phone"
          aria-label="Find member"
          className="pl-9"
        />
      </div>
      {debounced.length >= 2 && (
        <div className="mt-3">
          {results.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : results.isError ? (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              {formatServerError(results.error)}
              <Button size="sm" variant="outline" onClick={() => results.refetch()}>
                Retry
              </Button>
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members match "{debounced}".</p>
          ) : (
            <ul className="divide-y divide-border">
              {members.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[m.email, m.phone].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <Badge
                    variant={
                      m.status === "expired"
                        ? "destructive"
                        : m.status === "active"
                          ? "default"
                          : "secondary"
                    }
                  >
                    {STATUS_LABEL[m.status]}
                  </Badge>
                  <Button
                    size="sm"
                    className="rounded-xl"
                    disabled={checkIn.isPending}
                    onClick={() => checkIn.mutate({ id: m.id, name: m.name })}
                  >
                    Check in
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
