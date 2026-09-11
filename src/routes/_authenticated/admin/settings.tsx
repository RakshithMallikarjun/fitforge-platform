import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Copy, Eye, EyeOff, RefreshCw, Share2 } from "lucide-react";
import {
  getGymJoinCode,
  getGymSettings,
  regenerateGymJoinCode,
  updateGymOperations,
  updateGymSettings,
} from "@/lib/gym-theme.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
});

const FONTS = ["Satoshi", "Inter", "DM Sans", "Plus Jakarta Sans"] as const;

/** Common IANA zones for gym operators. */
const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Colombo",
  "Asia/Kathmandu",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Australia/Perth",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Lisbon",
  "Europe/Madrid",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Warsaw",
  "Europe/Athens",
  "Europe/Istanbul",
  "Europe/Moscow",
  "Africa/Lagos",
  "Africa/Cairo",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "America/New_York",
  "America/Toronto",
  "America/Chicago",
  "America/Mexico_City",
  "America/Denver",
  "America/Los_Angeles",
  "America/Vancouver",
  "America/Sao_Paulo",
  "America/Bogota",
  "Pacific/Auckland",
  "UTC",
] as const;

function CopyButton({
  value,
  label = "Copy",
  disabled,
}: {
  value: string;
  label?: string;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label === "Copy" ? "Copied" : label} to clipboard`);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Your browser blocked clipboard access — select and copy manually.");
    }
  }
  return (
    <Button type="button" variant="outline" size="sm" onClick={copy} disabled={disabled || !value}>
      {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
      {label}
    </Button>
  );
}

function SettingsPage() {
  const qc = useQueryClient();
  const fetchSettings = useServerFn(getGymSettings);
  const saveSettings = useServerFn(updateGymSettings);
  const saveOperations = useServerFn(updateGymOperations);
  const fetchJoinCode = useServerFn(getGymJoinCode);
  const rotateJoinCode = useServerFn(regenerateGymJoinCode);

  const { data: me } = useCurrentUser();
  const isAdmin = !!me?.roles.includes("admin");

  // getGymSettings throws "Forbidden" for non-admins, so never fire it for them.
  const { data: gym, isLoading } = useQuery({
    queryKey: ["gym-settings"],
    queryFn: () => fetchSettings(),
    enabled: isAdmin,
  });

  const [name, setName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#059669");
  const [secondaryColor, setSecondaryColor] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [fontFamily, setFontFamily] = useState<string>("Satoshi");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [customDomain, setCustomDomain] = useState("");

  useEffect(() => {
    if (!gym) return;
    setName(gym.name ?? "");
    setPrimaryColor(gym.primary_color ?? "#059669");
    setSecondaryColor(gym.secondary_color ?? "");
    setLogoUrl(gym.logo_url ?? "");
    setFontFamily(gym.font_family ?? "Satoshi");
    setSupportEmail(gym.support_email ?? "");
    setSupportPhone(gym.support_phone ?? "");
    setTimezone(gym.timezone ?? "UTC");
    setCustomDomain(gym.custom_domain ?? "");
  }, [gym]);


  const mutation = useMutation({
    mutationFn: (vars: {
      name: string;
      primaryColor: string;
      secondaryColor?: string | null;
      logoUrl?: string | null;
      fontFamily?: string | null;
      supportEmail?: string | null;
      supportPhone?: string | null;
    }) => saveSettings({ data: vars }),
    onSuccess: () => {
      toast.success("Gym branding updated");
      qc.invalidateQueries({ queryKey: ["gym-theme"] });
      qc.invalidateQueries({ queryKey: ["gym-settings"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save"),
  });

  const opsMutation = useMutation({
    mutationFn: (vars: { timezone: string; customDomain?: string | null }) =>
      saveOperations({ data: vars }),
    onSuccess: () => {
      toast.success("Operations settings saved");
      qc.invalidateQueries({ queryKey: ["gym-settings"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save"),
  });

  const { data: joinInfo, isLoading: joinLoading } = useQuery({
    queryKey: ["gym-join-code"],
    queryFn: () => fetchJoinCode(),
    enabled: isAdmin,
  });

  const [revealCode, setRevealCode] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);

  const rotateMutation = useMutation({
    mutationFn: () => rotateJoinCode(),
    onSuccess: () => {
      toast.success("New join code generated");
      setRevealCode(true);
      setConfirmRotate(false);
      qc.invalidateQueries({ queryKey: ["gym-join-code"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not regenerate the join code"),
  });

  const slug = joinInfo?.slug ?? gym?.slug ?? "";
  const joinCode = joinInfo?.joinCode ?? "";
  const appOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const signupMessage = `Join ${name || "our gym"} on FitForge 💪

1. Open ${appOrigin}/auth
2. Tap "Create account"
3. Gym code: ${slug}
4. Join code: ${joinCode}

See you at the gym!`;

  const validHex = /^#[0-9a-fA-F]{6}$/.test(primaryColor);
  const logoValid = logoUrl && /^https?:\/\//i.test(logoUrl);


  if (!isAdmin) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center px-6 py-20 text-center">
        <div className="rounded-2xl border border-border bg-muted/40 p-8">
          <h1 className="mb-2 font-display text-xl font-semibold tracking-tight">
            Branding settings are only available to gym administrators.
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Please contact your gym admin if you need changes made.
          </p>
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to admin dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-6 font-display text-3xl font-bold tracking-tight">Gym Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Gym Branding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="gym-name">Gym name</Label>
                <Input
                  id="gym-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Iron Works Performance"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="primary-color">Primary colour</Label>
                <div className="flex items-center gap-3">
                  <input
                    id="primary-color"
                    type="color"
                    value={validHex ? primaryColor : "#059669"}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded-md border border-border bg-transparent"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="max-w-[140px] font-mono"
                  />
                  {!validHex && <span className="text-xs text-destructive">Use #RRGGBB</span>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="secondary-color">Secondary colour (optional)</Label>
                <div className="flex items-center gap-3">
                  <input
                    id="secondary-color"
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(secondaryColor) ? secondaryColor : "#475569"}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded-md border border-border bg-transparent"
                  />
                  <Input
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    placeholder="Leave blank for neutral"
                    className="max-w-[180px] font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="logo-url">Logo URL</Label>
                <Input
                  id="logo-url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://…/logo.png"
                />
                {logoValid && (
                  <img
                    src={logoUrl}
                    alt="Logo preview"
                    className="mt-2 h-12 w-12 rounded-md border border-border object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>Font family</Label>
                <Select value={fontFamily} onValueChange={setFontFamily}>
                  <SelectTrigger className="max-w-[240px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONTS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="support-email">Support email</Label>
                  <Input
                    id="support-email"
                    type="email"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    placeholder="help@yourgym.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Shown to members. Leave blank to hide the support link.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="support-phone">Support WhatsApp number</Label>
                  <Input
                    id="support-phone"
                    value={supportPhone}
                    onChange={(e) => setSupportPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                  />
                  <p className="text-xs text-muted-foreground">
                    Include the country code. Leave blank to hide the chat link.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Live preview</Label>
                <div className="rounded-2xl border border-border bg-muted/40 p-6">
                  <span
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm"
                    style={{
                      backgroundColor: validHex ? primaryColor : "#059669",
                      fontFamily: `"${fontFamily}", ui-sans-serif, system-ui, sans-serif`,
                    }}
                  >
                    {logoValid && (
                      <img src={logoUrl} alt="" className="h-4 w-4 rounded-sm object-contain" />
                    )}
                    {name || "Your Gym"}
                  </span>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() =>
                    mutation.mutate({
                      name,
                      primaryColor,
                      secondaryColor: secondaryColor || null,
                      logoUrl: logoUrl || null,
                      fontFamily,
                      supportEmail: supportEmail || null,
                      supportPhone: supportPhone || null,
                    })
                  }
                  disabled={!validHex || !name.trim() || mutation.isPending}
                >
                  {mutation.isPending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Member sign-up</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="gym-code">Gym code — members enter this when signing up</Label>
            <div className="flex items-center gap-3">
              <Input id="gym-code" readOnly value={slug} className="max-w-[240px] font-mono" />
              <CopyButton value={slug} label="Copy code" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="join-code">Join code</Label>
            <div className="flex flex-wrap items-center gap-3">
              <Input
                id="join-code"
                readOnly
                value={
                  joinLoading
                    ? "Loading…"
                    : !joinCode
                      ? "Not set"
                      : revealCode
                        ? joinCode
                        : "•".repeat(joinCode.length)
                }
                className="max-w-[240px] font-mono tracking-widest"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRevealCode((v) => !v)}
                disabled={!joinCode}
              >
                {revealCode ? (
                  <EyeOff className="mr-2 h-4 w-4" />
                ) : (
                  <Eye className="mr-2 h-4 w-4" />
                )}
                {revealCode ? "Hide" : "Reveal"}
              </Button>
              <CopyButton value={joinCode} label="Copy join code" />
            </div>
            <p className="text-xs text-muted-foreground">
              Keep this private — anyone with the gym code and join code can create a member
              account.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmRotate(true)}
              disabled={rotateMutation.isPending}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {rotateMutation.isPending ? "Regenerating…" : "Regenerate join code"}
            </Button>
            <Button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(signupMessage);
                  toast.success("Sign-up instructions copied — paste them into WhatsApp");
                } catch {
                  toast.error("Your browser blocked clipboard access.");
                }
              }}
              disabled={!joinCode || !slug}
            >
              <Share2 className="mr-2 h-4 w-4" />
              Copy sign-up instructions
            </Button>
          </div>

          <pre className="whitespace-pre-wrap rounded-2xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
            {revealCode || !joinCode
              ? signupMessage
              : signupMessage.replace(joinCode, "••••••••••••")}

          </pre>
        </CardContent>
      </Card>

      <AlertDialog open={confirmRotate} onOpenChange={setConfirmRotate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate the join code?</AlertDialogTitle>
            <AlertDialogDescription>
              Any invite message or join code you have already shared will stop working
              immediately. Members who have already signed up are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => rotateMutation.mutate()}>
              Regenerate code
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Operations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="max-w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Streaks, attendance and daily reports are calculated in this timezone.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-domain">Custom domain</Label>
            <Input
              id="custom-domain"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder="app.yourgym.com"
              className="max-w-[320px]"
            />
            <div className="rounded-2xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
              <p className="mb-2 font-semibold text-foreground">DNS setup</p>
              <p className="mb-2">
                Subdomain option: add a wildcard <code>CNAME</code> for{" "}
                <code>*.fitforge.app</code> pointing at your published FitForge URL. Members
                visiting <code>{slug || "yourgym"}.fitforge.app</code> get your theme, logo and
                app icon automatically.
              </p>
              <p>
                Fully custom domain: save it here, add a <code>CNAME</code> from{" "}
                <code>{customDomain || "app.yourgym.com"}</code> to your published FitForge URL,
                then ask FitForge support to attach the domain to your project.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Subscription</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="capitalize">
                {gym?.subscription_plan ?? "—"} plan
              </Badge>
              <Badge variant="outline" className="capitalize">
                Payment: {gym?.payment_status ?? "—"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Managed by FitForge — contact support to change.
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() =>
                opsMutation.mutate({ timezone, customDomain: customDomain || null })
              }
              disabled={opsMutation.isPending || !timezone}
            >
              {opsMutation.isPending ? "Saving…" : "Save operations"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

}
