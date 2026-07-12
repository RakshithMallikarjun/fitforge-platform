import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, XCircle, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { GlassHeader } from "@/components/glass-header";
import { Button } from "@/components/ui/button";
import { verifyAndCheckin } from "@/lib/checkin.functions";

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

  async function start() {
    if (scanning) return;
    const mod = await import("html5-qrcode");
    const { Html5Qrcode } = mod;
    const id = "fitforge-qr-reader";
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
            const r = await verify({ data: { token: decodedText } });
            const name = r.member?.display_name ?? r.member?.email ?? "Member";
            setRecent((cur) => [{ at: now, ok: true, message: `Checked in ${name}` }, ...cur].slice(0, 10));
            toast.success(`Checked in ${name}`);
          } catch (e: any) {
            setRecent((cur) => [{ at: now, ok: false, message: e?.message ?? "Invalid code" }, ...cur].slice(0, 10));
            toast.error("Check-in failed", { description: e?.message });
          } finally {
            busyRef.current = false;
          }
        },
        () => {}, // ignore scan errors
      );
      setScanning(true);
    } catch (e: any) {
      toast.error("Could not start camera", { description: e?.message });
    }
  }

  async function stop() {
    const s = scannerRef.current;
    if (!s) return;
    try {
      await s.stop();
      await s.clear();
    } catch { /* ignore */ }
    scannerRef.current = null;
    setScanning(false);
  }

  useEffect(() => () => { void stop(); }, []);

  return (
    <>
      <GlassHeader title="Front desk check-in" subtitle="Scan a member's QR code" initials="QR" />
      <main className="mx-auto max-w-3xl space-y-6 px-8 py-8">
        <div className="rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <div ref={containerRef} className="mx-auto aspect-square w-full max-w-md overflow-hidden rounded-2xl bg-black/90" />
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {scanning ? "Point the camera at a member's QR code." : "Tap start to activate the camera."}
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

        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold tracking-tight">Recent scans</h3>
          {recent.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No scans yet.</p>
          ) : (
          <ul className="mt-3 space-y-2 text-sm">
              {recent.map((r) => (
                <li key={r.at} className="flex items-center gap-2">
                  {r.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className="text-muted-foreground">{new Date(r.at).toLocaleTimeString()}</span>
                  <span>{r.message}</span>
                  <span className="ml-auto inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    Gym
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
