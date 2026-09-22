import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const DISMISS_KEY = "fitfoundry.ads.dismissed";
const SEEN_KEY = "fitfoundry.ads.seen";

function safeSessionGet(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(DISMISS_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function safeSessionAdd(id: string) {
  try {
    const next = Array.from(new Set([...safeSessionGet(), id]));
    sessionStorage.setItem(DISMISS_KEY, JSON.stringify(next));
  } catch {
    /* private mode — dismissal is just not remembered */
  }
}

/** Courtesy frequency cap. The server count is the real one. */
function seenToday(): { day: string; ids: string[] } {
  const day = new Date().toISOString().slice(0, 10);
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "null") as {
      day: string;
      ids: string[];
    } | null;
    if (raw && raw.day === day && Array.isArray(raw.ids)) return raw;
  } catch {
    /* ignore */
  }
  return { day, ids: [] };
}

function markSeenToday(id: string) {
  try {
    const cur = seenToday();
    if (cur.ids.includes(id)) return;
    localStorage.setItem(SEEN_KEY, JSON.stringify({ day: cur.day, ids: [...cur.ids, id] }));
  } catch {
    /* ignore */
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
            onClick={onDismiss}
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
            onClick={() => onClick?.()}
          >
            <a href={ad.ctaUrl} target="_blank" rel="noopener noreferrer">
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
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => setDismissed(safeSessionGet()), []);

  const { data } = useQuery({
    queryKey: ["ads", placement],
    queryFn: () => fetchAds({ data: { placement, limit: 1 } }),
    staleTime: 5 * 60_000,
    retry: false,
    // A member must never see an ad error state.
    throwOnError: false,
  });

  const ad = useMemo(() => {
    const candidates = data?.ads ?? [];
    const cap = data?.maxPerMemberDay ?? 3;
    const seen = seenToday();
    return (
      candidates.find(
        (a) =>
          !dismissed.includes(a.id) &&
          (seen.ids.includes(a.id) || seen.ids.length < Math.max(0, cap)),
      ) ?? null
    );
  }, [data, dismissed]);

  const onImpression = useCallback(() => {
    if (!ad) return;
    markSeenToday(ad.id);
    void record({ data: { adId: ad.id, event: "impression" } }).catch(() => {});
  }, [ad, record]);

  const onClick = useCallback(() => {
    if (!ad) return;
    void record({ data: { adId: ad.id, event: "click" } }).catch(() => {});
  }, [ad, record]);

  if (!ad) return null;

  return (
    <SponsoredCard
      ad={ad}
      onImpression={onImpression}
      onClick={onClick}
      onDismiss={() => {
        safeSessionAdd(ad.id);
        setDismissed((d) => [...d, ad.id]);
      }}
    />
  );
}
