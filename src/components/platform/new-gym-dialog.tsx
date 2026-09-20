import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronDown, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { checkGymSlug, createGym, type SubscriptionPlan } from "@/lib/platform.functions";

const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC",
];
const CURRENCIES = ["INR", "USD", "AED", "GBP", "EUR"];
const PLANS: SubscriptionPlan[] = ["starter", "growth", "pro", "chain"];

export function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 32)
    .replace(/^-|-$/g, "");
}

function localValidation(slug: string): string | null {
  if (slug.length < 3) return "Gym code must be at least 3 characters";
  if (slug.length > 32) return "Gym code must be at most 32 characters";
  if (!/^[a-z0-9]([a-z0-9-]{1,30})[a-z0-9]$/.test(slug))
    return "Use lowercase letters, numbers and hyphens, starting and ending with a letter or number";
  if (slug.includes("--")) return "Gym code cannot contain two hyphens in a row";
  return null;
}

export function NewGymDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const submitGym = useServerFn(createGym);
  const verifySlug = useServerFn(checkGymSlug);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [currency, setCurrency] = useState("INR");
  const [plan, setPlan] = useState<SubscriptionPlan>("starter");
  const [showOptional, setShowOptional] = useState(false);
  const [primaryColor, setPrimaryColor] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [step, setStep] = useState<null | "creating" | "inviting">(null);

  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  const effectiveSlug = slugEdited ? slug : slugify(name);
  const localError = effectiveSlug ? localValidation(effectiveSlug) : null;

  function reset() {
    setName("");
    setSlug("");
    setSlugEdited(false);
    setOwnerEmail("");
    setTimezone("Asia/Kolkata");
    setCurrency("INR");
    setPlan("starter");
    setShowOptional(false);
    setPrimaryColor("");
    setSupportEmail("");
    setSupportPhone("");
    setInternalNote("");
    setAvailable(null);
    setChecking(false);
    setStep(null);
  }

  useEffect(() => {
    if (!open) return;
    setAvailable(null);
    if (!effectiveSlug || localError) return;
    setChecking(true);
    const t = setTimeout(() => {
      verifySlug({ data: { slug: effectiveSlug } })
        .then((r) => setAvailable(r.available))
        .catch(() => setAvailable(null))
        .finally(() => setChecking(false));
    }, 400);
    return () => {
      clearTimeout(t);
      setChecking(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSlug, localError, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      setStep("creating");
      if (ownerEmail.trim()) setStep("inviting");
      return submitGym({
        data: {
          name: name.trim(),
          slug: effectiveSlug,
          timezone,
          currency,
          subscriptionPlan: plan,
          ownerEmail: ownerEmail.trim() || undefined,
          primaryColor: primaryColor.trim() || undefined,
          supportEmail: supportEmail.trim() || undefined,
          supportPhone: supportPhone.trim() || undefined,
          internalNote: internalNote.trim() || undefined,
        },
      });
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["platform-gyms"] });
      qc.invalidateQueries({ queryKey: ["platform-overview"] });
      if (r.inviteError) {
        toast.error(`Gym created, but the owner invite failed: ${r.inviteError}`);
      } else if (r.ownerInvited) {
        toast.success("Gym created and the owner has been invited");
      } else {
        toast.success("Gym created — invite an owner next");
      }
      onOpenChange(false);
      reset();
      navigate({ to: "/platform/gyms/$gymId", params: { gymId: r.gymId } });
    },
    onError: (e) => {
      setStep(null);
      toast.error((e as Error).message || "Could not create the gym");
    },
  });

  const canSubmit = useMemo(
    () =>
      name.trim().length > 0 &&
      !!effectiveSlug &&
      !localError &&
      !checking &&
      available === true &&
      !mutation.isPending,
    [name, effectiveSlug, localError, checking, available, mutation.isPending],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (mutation.isPending) return;
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New gym</DialogTitle>
          <DialogDescription>
            Creates the gym enabled and on a trial, then emails the owner an invite that makes them
            an admin of this gym only.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="gym-name">Gym name</Label>
            <Input
              id="gym-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Iron Works Performance"
              maxLength={80}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gym-slug">Gym code</Label>
            <Input
              id="gym-slug"
              value={effectiveSlug}
              onChange={(e) => {
                setSlugEdited(true);
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
              }}
              placeholder="iron-works"
            />
            <p className="text-xs text-muted-foreground">
              {effectiveSlug ? `${effectiveSlug}.fitforge.app` : "Fills in from the gym name."}
            </p>
            {effectiveSlug && localError ? (
              <p className="flex items-center gap-1 text-xs font-medium text-destructive">
                <X className="h-3.5 w-3.5" /> {localError}
              </p>
            ) : checking ? (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking availability…
              </p>
            ) : available === true ? (
              <p className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5" /> Available
              </p>
            ) : available === false ? (
              <p className="flex items-center gap-1 text-xs font-medium text-destructive">
                <X className="h-3.5 w-3.5" /> That gym code is taken or reserved
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gym-owner">Owner email</Label>
            <Input
              id="gym-owner"
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="owner@gym.com"
            />
            <p className="text-xs text-muted-foreground">
              Optional now — you can invite the owner later from the gym page.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <Select value={plan} onValueChange={(v) => setPlan(v as SubscriptionPlan)}>
                <SelectTrigger className="capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLANS.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-xl border border-border">
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold"
              onClick={() => setShowOptional((s) => !s)}
            >
              Optional
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showOptional ? "rotate-180" : ""}`}
              />
            </button>
            {showOptional && (
              <div className="space-y-3 border-t border-border p-3">
                <div className="space-y-1.5">
                  <Label htmlFor="gym-color">Primary colour</Label>
                  <Input
                    id="gym-color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#059669"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gym-support-email">Support email</Label>
                  <Input
                    id="gym-support-email"
                    type="email"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gym-support-phone">Support phone</Label>
                  <Input
                    id="gym-support-phone"
                    value={supportPhone}
                    onChange={(e) => setSupportPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gym-note">Internal note</Label>
                  <Textarea
                    id="gym-note"
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    placeholder="Only platform admins see this."
                  />
                </div>
              </div>
            )}
          </div>

          {step && (
            <ul className="space-y-1.5 rounded-xl bg-muted p-3 text-xs">
              <li className="flex items-center gap-2">
                {step === "creating" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                )}
                Creating gym
              </li>
              {ownerEmail.trim() && (
                <li className="flex items-center gap-2">
                  {step === "inviting" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <span className="h-3.5 w-3.5" />
                  )}
                  Inviting owner
                </li>
              )}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              reset();
            }}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Creating…" : "Create gym"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
