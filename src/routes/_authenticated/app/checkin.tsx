import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { issueCheckinToken } from "@/lib/checkin.functions";

export const Route = createFileRoute("/_authenticated/app/checkin")({
  component: CheckinPage,
});

function CheckinPage() {
  const navigate = useNavigate();
  const issue = useServerFn(issueCheckinToken);
  const [token, setToken] = useState<string | null>(null);
  const [ttl, setTtl] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const r = await issue();
      setToken(r.token);
      setTtl(r.expiresIn);
    } catch (e: any) {
      toast.error("Could not generate check-in code", { description: e?.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ttl <= 0) return;
    const id = window.setInterval(() => setTtl((t) => Math.max(0, t - 1)), 1000);
    return () => window.clearInterval(id);
  }, [ttl]);

  const expired = ttl === 0 && token !== null;

  return (
    <div className="space-y-5">
      <button
        onClick={() => navigate({ to: "/app" })}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Home
      </button>

      <div>
        <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Gym check-in</p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">Scan me at the desk</h1>
      </div>

      <div className="rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="grid place-items-center rounded-2xl bg-white p-6">
          {token && !expired ? (
            <QRCodeSVG value={token} size={240} bgColor="#ffffff" fgColor="#0F172A" level="M" />
          ) : (
            <div className="grid h-[240px] w-[240px] place-items-center text-sm text-muted-foreground">
              {loading ? "Generating…" : "Code expired"}
            </div>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            {expired ? "Expired" : `Expires in ${Math.floor(ttl / 60)}:${String(ttl % 60).padStart(2, "0")}`}
          </div>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={refresh} disabled={loading}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> New code
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Show this code to the front desk to log your visit. Codes expire after 5 minutes for your security.
      </p>
    </div>
  );
}
