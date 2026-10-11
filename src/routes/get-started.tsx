import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Dumbbell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MEMBER_COUNT_OPTIONS, submitLead } from "@/lib/leads.functions";
import { formatServerError } from "@/lib/format-error";

const TITLE = "Get started with Fit Foundry — set up your gym";
const DESC =
  "Tell us about your gym and we'll set up Fit Foundry for you — memberships, dues, attendance and a branded member app.";

export const Route = createFileRoute("/get-started")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GetStartedPage,
});

function GetStartedPage() {
  const submit = useServerFn(submitLead);
  const [f, setF] = useState({
    contact_name: "",
    gym_name: "",
    city: "",
    phone: "",
    email: "",
    member_count: "",
    website: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!f.member_count) {
      setError("Choose roughly how many members you have.");
      return;
    }
    setBusy(true);
    try {
      await submit({ data: { ...f, member_count: f.member_count as any, website: f.website || undefined } });
      setDone(true);
    } catch (err) {
      setError(formatServerError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="glass-header">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4 md:px-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Dumbbell className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight">Fit Foundry</span>
          </Link>
          <Link to="/auth">
            <Button variant="ghost" className="rounded-xl">
              Member sign in
            </Button>
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-lg px-6 py-12">
        <h1 className="font-display text-3xl font-bold tracking-tight">Set up your gym</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tell us a little about your gym. We'll create your account and send you everything you need.
        </p>

        {done ? (
          <div role="status" className="mt-8 rounded-2xl border border-border bg-card p-6 text-card-foreground">
            <CheckCircle2 className="h-6 w-6 text-primary" />
            <p className="mt-3 font-semibold">
              Thanks — we'll set up your gym and email you within one working day.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-2xl border border-border bg-card p-6">
            <div className="space-y-1.5">
              <Label htmlFor="gs-name">Your name</Label>
              <Input id="gs-name" required maxLength={120} value={f.contact_name} onChange={set("contact_name")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gs-gym">Gym name</Label>
              <Input id="gs-gym" required maxLength={120} value={f.gym_name} onChange={set("gym_name")} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="gs-city">City</Label>
                <Input id="gs-city" required maxLength={80} value={f.city} onChange={set("city")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gs-phone">Phone</Label>
                <Input id="gs-phone" required type="tel" inputMode="tel" maxLength={30} value={f.phone} onChange={set("phone")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gs-email">Email</Label>
              <Input id="gs-email" required type="email" maxLength={200} value={f.email} onChange={set("email")} />
            </div>
            <div className="space-y-1.5">
              <Label>Number of members</Label>
              <Select value={f.member_count} onValueChange={(v) => setF((p) => ({ ...p, member_count: v }))}>
                <SelectTrigger aria-label="Number of members">
                  <SelectValue placeholder="Choose one" />
                </SelectTrigger>
                <SelectContent>
                  {MEMBER_COUNT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Honeypot: hidden from people, filled by bots. */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="hidden"
              value={f.website}
              onChange={set("website")}
            />
            {error && (
              <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="h-11 w-full rounded-xl" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Request setup
            </Button>
          </form>
        )}
      </section>
    </main>
  );
}
