import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { recordAdEvent, serveAds, type AdPlacement, type ServedAd } from "@/lib/ads.functions";

/**
 * Sponsored cards shown to members.
 *
 * Deliberately quiet: never an interstitial, never blocking, and it renders
 * nothing at all when there is no ad (or when the lookup fails).
 */

const LEDGER_PREFIX = "fitfoundry.ads.day.";

/**
 * Per-device, per-gym, per-day ledger. Lives only in localStorage, so the
 * server never learns which member saw which ad.
 *  - shows: how many times a sponsored card was displayed today (daily cap)
 *  - impressed: ad ids already counted as an impression today
 *  - dismissed: ad ids hidden with the X today
 */
type Ledger = { day: string; shows: number; impressed: string[]; dismissed: string[] };

function deviceDay(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dd}`;
}

function readLedger(gymId: string): Ledger {
  const day = deviceDay();
  try {
    const raw = JSON.parse(localStorage.getItem(LEDGER_PREFIX + gymId) ?? "null") as Ledger | null;
    if (raw && raw.day === day) {
      return {
        day,
        shows: Number(raw.shows) || 0,
        impressed: Array.isArray(raw.impressed) ? raw.impressed : [],
        dismissed: Array.isArray(raw.dismissed) ? raw.dismissed : [],
      };
    }
  } catch {
    /* ignore */
  }
  return { day, shows: 0, impressed: [], dismissed: [] };
}

function updateLedger(gymId: string, fn: (l: Ledger) => Ledger) {
  try {
    localStorage.setItem(LEDGER_PREFIX + gymId, JSON.stringify(fn(readLedger(gymId))));
  } catch {
    /* private mode — cap is best-effort */
  }
}

export function SponsoredCard({
  ad,
  onDismiss,
  onImpression,
  onClick,
}: {
  ad: ServedAd;
  onDismiss?: () => void;
  onImpression?: () => void;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const fired = useRef(false);

  useEffect(() => {
    if (!onImpression) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.5);
        if (visible && !fired.current) {
          timer = setTimeout(() => {
            if (fired.current) return;
            fired.current = true;
            onImpression();
            observer.disconnect();
          }, 1000);
        } else if (!visible && timer) {
          clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: [0, 0.5, 1] },
    );
    observer.observe(el);
    return () => {
      if (timer) clearTimeout(timer);
      observer.disconnect();
    };
  }, [onImpression]);

  return (
    <div
      ref={ref}
      className="relative overflow-hidden rounded-[2rem] border border-border bg-card shadow-[var(--shadow-card)]"
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Sponsored
        </span>
        {onDismiss && (
          <button
            type="button"
            aria-label="Hide this sponsored card"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDismiss();
            }}
            className="-mr-1 -mt-1 rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {ad.imageUrl && (
        <div className="mt-3 aspect-video w-full overflow-hidden bg-muted">
          <img
            src={ad.imageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}

      <div className="px-5 pb-5 pt-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {ad.advertiserName}
        </p>
        <p className="mt-1 text-base font-semibold leading-snug tracking-tight">{ad.headline}</p>
        {ad.body && <p className="mt-1.5 text-sm text-muted-foreground">{ad.body}</p>}
        {ad.ctaUrl && ad.ctaUrl.startsWith("https://") && (
          <Button
            asChild
            size="sm"
            variant="outline"
            className="mt-4 rounded-xl"
          >
            <a
              href={ad.ctaUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onClick?.()}
            >
              {ad.ctaLabel || "Learn more"}
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

/** Fetches and renders one sponsored card for a placement, or nothing at all. */
export function SponsoredSlot({ placement }: { placement: AdPlacement }) {
  const fetchAds = useServerFn(serveAds);
  const record = useServerFn(recordAdEvent);
  // Chosen once per mount so re-renders never count as a new showing.
  const [chosen, setChosen] = useState<ServedAd | null>(null);
  const decided = useRef(false);
  const counted = useRef(false);

  const { data } = useQuery({
    queryKey: ["ads", placement],
    queryFn: () => fetchAds({ data: { placement, limit: 3 } }),
    staleTime: 5 * 60_000,
    retry: false,
    // A member must never see an ad error state.
    throwOnError: false,
  });

  const gymId = data?.gymId ?? null;

  useEffect(() => {
    if (decided.current || !data || !gymId) return;
    decided.current = true;
    const ledger = readLedger(gymId);
    const cap = Math.max(0, data.maxPerMemberDay ?? 3);
    if (ledger.shows >= cap) return;
    const ad = data.ads.find((a) => !ledger.dismissed.includes(a.id)) ?? null;
    setChosen(ad);
  }, [data, gymId]);

  const onImpression = useCallback(() => {
    if (!chosen || !gymId || counted.current) return;
    counted.current = true;
    let firstToday = false;
    updateLedger(gymId, (l) => {
      firstToday = !l.impressed.includes(chosen.id);
      return {
        ...l,
        shows: l.shows + 1,
        impressed: firstToday ? [...l.impressed, chosen.id] : l.impressed,
      };
    });
    if (firstToday) {
      void record({ data: { adId: chosen.id, event: "impression" } }).catch(() => {});
    }
  }, [chosen, gymId, record]);

  const onClick = useCallback(() => {
    if (!chosen) return;
    void record({ data: { adId: chosen.id, event: "click" } }).catch(() => {});
  }, [chosen, record]);

  const onDismiss = useCallback(() => {
    if (!chosen) return;
    const id = chosen.id;
    if (gymId) {
      updateLedger(gymId, (l) => ({
        ...l,
        dismissed: l.dismissed.includes(id) ? l.dismissed : [...l.dismissed, id],
      }));
    }
    void record({ data: { adId: id, event: "dismiss" } }).catch(() => {});
    setChosen(null);
  }, [chosen, gymId, record]);

  if (!chosen) return null;

  return (
    <SponsoredCard ad={chosen} onImpression={onImpression} onClick={onClick} onDismiss={onDismiss} />
  );
}
