import { useCallback, useEffect, useState } from "react";
import { formatServerError } from "@/lib/format-error";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Dumbbell, Home, Loader2, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { getMyCheckinToday, issueCheckinToken, selfCheckin } from "@/lib/checkin.functions";
import { useMembership } from "@/lib/membership-context";
import { SponsoredSlot } from "@/components/ads/sponsored-card";

export const Route = createFileRoute("/_authenticated/app/checkin")({
  component: CheckinPage,
});

function CheckinPage() {
  const membership = useMembership();
  const todayFn = useServerFn(getMyCheckinToday);
  const today = useQuery({
    queryKey: ["my-checkin-today"],
    queryFn: () => todayFn(),
    enabled: !membership?.expired,
    retry: 1,
  });
  if (membership?.expired) {
    return (
      <main className="mx-auto w-full max-w-lg px-5 py-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Check in</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Checking in is paused because your membership expired
          {membership.expiresAt ? ` on ${membership.expiresAt}` : ""}. Contact{" "}
          {membership.gymName ?? "your gym"} to renew — your history stays available.
        </p>
      </main>
    );
  }
  if (today.isLoading) {
    return (
      <main className="mx-auto w-full max-w-lg space-y-4 px-5 py-8">
        <Skeleton className="mx-auto h-8 w-40" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </main>
    );
  }
  const existing = today.data?.checkin;
  if (existing) {
    return (
      <main className="mx-auto w-full max-w-lg px-5 py-8">
        <CheckedInToday
          at={existing.at}
          location={existing.location}
          timeZone={today.data?.timeZone ?? "UTC"}
        />
      </main>
    );
  }
  return (
    <main className="mx-auto w-full max-w-lg px-5 py-8">
      {today.isError && (
        <p className="mb-4 rounded-2xl border border-border bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
          Couldn't check whether you're already checked in today.
        </p>
      )}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Check in</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Scan at the front desk, or log a session you did at home.
        </p>
      </div>

      <Tabs defaultValue="gym">
        <TabsList className="grid w-full grid-cols-2 rounded-2xl">
          <TabsTrigger value="gym" className="rounded-xl">
            Scan at the gym
          </TabsTrigger>
          <TabsTrigger value="home" className="rounded-xl">
            Log a home session
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gym" className="mt-6">
          <GymQrTab />
        </TabsContent>

        <TabsContent value="home" className="mt-6">
          <HomeSessionTab />
        </TabsContent>
      </Tabs>
    </main>
  );
}

function CheckedInToday({
  at,
  location,
  timeZone,
}: {
  at: string;
  location: string;
  timeZone: string;
}) {
  const navigate = useNavigate();
  const isHome = location === "home";
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(at));
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary">
          {isHome ? <Home className="h-7 w-7" /> : <Dumbbell className="h-7 w-7" />}
        </div>
        <p className="mt-4 text-base font-semibold">
          You're checked in for today — {isHome ? "Home" : "Gym"}, {time}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Come back tomorrow for your next check-in.
        </p>
      </div>
      <SponsoredSlot placement="checkin_success" />
      <Button className="w-full rounded-xl" onClick={() => navigate({ to: "/app" })}>
        Back to home
      </Button>
    </div>
  );
}

function formatRemaining(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function GymQrTab() {
  const issue = useServerFn(issueCheckinToken);
  const [token, setToken] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await issue({ data: undefined as any });
      setToken(res.token);
      setRemaining(res.expiresIn ?? 300);
    } catch (e: any) {
      const raw = String(e?.message ?? "");
      setError(
        /secret not configured/i.test(raw)
          ? "QR check-in isn't set up for your gym yet. Ask the front desk to check you in manually."
          : "We couldn't create your check-in code. Please try again in a moment.",
      );
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, [issue]);

  useEffect(() => {
    void load();
  }, [load]);

  // Countdown; refresh automatically when the code expires.
  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          void load();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [token, load]);

  if (error) {
    return (
      <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button className="mt-4 rounded-xl" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="w-full rounded-3xl bg-white p-6 shadow-[var(--shadow-card)]">
        <div className="grid aspect-square w-full place-items-center">
          {loading || !token ? (
            <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
          ) : (
            <QRCodeSVG
              value={token}
              level="M"
              bgColor="#ffffff"
              fgColor="#000000"
              className="h-full w-full"
            />
          )}
        </div>
      </div>

      <p className="mt-5 text-center text-sm font-semibold">
        Valid for {formatRemaining(remaining)}
      </p>
      <p className="mt-1 text-center text-xs text-muted-foreground">
        Show this to the front desk. Refreshes every 5 minutes.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-4 rounded-xl"
        disabled={loading}
        onClick={() => void load()}
      >
        <RefreshCw className="mr-1.5 h-4 w-4" /> New code
      </Button>
    </div>
  );
}

function HomeSessionTab() {
  const checkin = useServerFn(selfCheckin);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => checkin({ data: { locationType: "home" as const } }),
    onSuccess: (res: any) => {
      toast.success(
        res?.alreadyCheckedIn ? "Today's session is already logged ✓" : "Home session logged ✓",
      );
      void qc.invalidateQueries({ queryKey: ["my-checkin-today"] });
    },
    onError: (e: any) =>
      toast.error("Couldn't log your session", { description: formatServerError(e) }),
  });

  return (
    <div className="space-y-4">
      <button
        type="button"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
        className="flex w-full items-center gap-4 rounded-3xl border border-border bg-card p-5 text-left shadow-[var(--shadow-card)] transition hover:border-primary hover:bg-accent disabled:opacity-60"
      >
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
          <Home className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold">At Home</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Home session will be logged to your progress
          </p>
        </div>
      </button>
      <p className="text-center text-xs text-muted-foreground">
        {mutation.isPending
          ? "Recording…"
          : "Gym visits are recorded by the front desk when they scan your code."}
      </p>
    </div>
  );
}
