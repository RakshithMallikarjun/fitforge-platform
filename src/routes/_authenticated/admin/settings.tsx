import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getGymSettings, updateGymSettings } from "@/lib/gym-theme.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
});

const FONTS = ["Satoshi", "Inter", "DM Sans", "Plus Jakarta Sans"] as const;

function SettingsPage() {
  const qc = useQueryClient();
  const fetchSettings = useServerFn(getGymSettings);
  const saveSettings = useServerFn(updateGymSettings);

  const { data: gym, isLoading } = useQuery({
    queryKey: ["gym-settings"],
    queryFn: () => fetchSettings(),
  });

  const [name, setName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#059669");
  const [logoUrl, setLogoUrl] = useState("");
  const [fontFamily, setFontFamily] = useState<string>("Satoshi");

  useEffect(() => {
    if (!gym) return;
    setName(gym.name ?? "");
    setPrimaryColor(gym.primary_color ?? "#059669");
    setLogoUrl(gym.logo_url ?? "");
    setFontFamily(gym.font_family ?? "Satoshi");
  }, [gym]);

  const mutation = useMutation({
    mutationFn: (vars: {
      name: string;
      primaryColor: string;
      logoUrl?: string | null;
      fontFamily?: string | null;
    }) => saveSettings({ data: vars }),
    onSuccess: () => {
      toast.success("Gym branding updated");
      qc.invalidateQueries({ queryKey: ["gym-theme"] });
      qc.invalidateQueries({ queryKey: ["gym-settings"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save"),
  });

  const validHex = /^#[0-9a-fA-F]{6}$/.test(primaryColor);
  const logoValid = logoUrl && /^https?:\/\//i.test(logoUrl);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-6 font-display text-3xl font-bold tracking-tight">
        Gym Settings
      </h1>

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
                  {!validHex && (
                    <span className="text-xs text-destructive">Use #RRGGBB</span>
                  )}
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
                      <img
                        src={logoUrl}
                        alt=""
                        className="h-4 w-4 rounded-sm object-contain"
                      />
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
                      logoUrl: logoUrl || null,
                      fontFamily,
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
    </div>
  );
}
