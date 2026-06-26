import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme-provider";

const DISMISS_KEY = "fitforge:install-dismissed-at";
const DISMISS_DAYS = 7;

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function recentlyDismissed() {
  try {
    const v = localStorage.getItem(DISMISS_KEY);
    if (!v) return false;
    const ts = Number(v);
    if (!ts) return false;
    return Date.now() - ts < DISMISS_DAYS * 86400_000;
  } catch {
    return false;
  }
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  // iOS Safari
  // @ts-expect-error legacy iOS property
  if (window.navigator.standalone) return true;
  return window.matchMedia?.("(display-mode: standalone)").matches ?? false;
}

function isIos() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
}

export function InstallPrompt() {
  const { theme } = useTheme();
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone() || recentlyDismissed()) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    // iOS Safari has no beforeinstallprompt — show after a short delay
    if (isIos()) {
      const t = setTimeout(() => setShow(true), 1500);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onBIP);
      };
    }
    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch { /* ignore */ }
    setShow(false);
  };

  const install = async () => {
    if (deferred) {
      try {
        await deferred.prompt();
        await deferred.userChoice;
      } finally {
        setDeferred(null);
        setShow(false);
      }
    } else if (isIos()) {
      setIosHelp(true);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-20 z-40 mx-auto max-w-md px-4">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-[0_12px_30px_-10px_rgba(0,0,0,0.18)]">
        <button
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <div className="flex items-start gap-3 pr-6">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Download className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold tracking-tight">Install {theme.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Add to your home screen for a faster, full-screen experience.
            </p>

            {iosHelp ? (
              <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                Tap <Share className="inline h-3 w-3 align-text-bottom" /> <strong>Share</strong> in
                Safari, then choose <strong>Add to Home Screen</strong>.
              </p>
            ) : (
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={install} className="h-8 rounded-lg px-3 text-xs">
                  {isIos() ? "How to install" : "Install"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={dismiss}
                  className="h-8 rounded-lg px-3 text-xs"
                >
                  Not now
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
