import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SponsoredCard } from "@/components/ads/sponsored-card";
import {
  createGymAd,
  createPlatformAd,
  updateGymAd,
  updatePlatformAd,
  uploadAdCreative,
  type AdPlacement,
  type AdRow,
  type AdStatus,
} from "@/lib/ads.functions";

const PLACEMENTS: { value: AdPlacement; label: string }[] = [
  { value: "home_feed", label: "Member home" },
  { value: "workout_complete", label: "After a workout" },
  { value: "checkin_success", label: "After a check-in" },
];

const STATUSES: AdStatus[] = ["draft", "active", "paused", "archived"];

const MAX_BYTES = 500 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function fileToBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buf.length; i += 1) binary += String.fromCharCode(buf[i]!);
  return btoa(binary);
}

export function AdFormDialog({
  open,
  onOpenChange,
  scope,
  ad,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: "gym" | "platform";
  ad?: AdRow | null;
  onSaved: () => void;
}) {
  const upload = useServerFn(uploadAdCreative);
  const saveGym = useServerFn(ad ? updateGymAd : createGymAd);
  const savePlatform = useServerFn(ad ? updatePlatformAd : createPlatformAd);

  const [advertiserName, setAdvertiserName] = useState("");
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [placement, setPlacement] = useState<AdPlacement>("home_feed");
  const [status, setStatus] = useState<AdStatus>("draft");
  const [startsOn, setStartsOn] = useState(todayISO());
  const [endsOn, setEndsOn] = useState("");
  const [priority, setPriority] = useState(0);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAdvertiserName(ad?.advertiser_name ?? "");
    setHeadline(ad?.headline ?? "");
    setBody(ad?.body ?? "");
    setCtaLabel(ad?.cta_label ?? "");
    setCtaUrl(ad?.cta_url ?? "");
    setPlacement(ad?.placement ?? "home_feed");
    setStatus(ad?.status ?? "draft");
    setStartsOn(ad?.starts_on ?? todayISO());
    setEndsOn(ad?.ends_on ?? "");
    setPriority(ad?.priority ?? 0);
    setImagePath(ad?.image_path ?? null);
    setImageUrl(null);
    setUploading(false);
  }, [open, ad]);

  const urlError = useMemo(() => {
    const v = ctaUrl.trim();
    if (!v) return null;
    return /^https:\/\/\S+$/i.test(v) ? null : "Links must start with https://";
  }, [ctaUrl]);

  const canSave =
    advertiserName.trim().length > 0 &&
    headline.trim().length > 0 &&
    headline.trim().length <= 60 &&
    !urlError &&
    !uploading &&
    (!endsOn || endsOn >= startsOn);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        advertiserName: advertiserName.trim(),
        headline: headline.trim(),
        body: body.trim() || null,
        imagePath,
        ctaLabel: ctaLabel.trim() || null,
        ctaUrl: ctaUrl.trim() || null,
        placement,
        status,
        startsOn,
        endsOn: endsOn || null,
        priority,
      };
      const data = ad ? { ...payload, id: ad.id } : payload;
      return scope === "platform"
        ? savePlatform({ data: data as never })
        : saveGym({ data: data as never });
    },
    onSuccess: () => {
      toast.success(ad ? "Sponsor updated" : "Sponsor created");
      onOpenChange(false);
      onSaved();
    },
    onError: (e: any) =>
      toast.error("Couldn't save this sponsor", { description: e?.message ?? "Please try again." }),
  });

  async function onPickFile(file: File) {
    if (!ALLOWED.includes(file.type)) {
      toast.error("Use a PNG, JPEG or WebP image");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Images must be 500KB or smaller");
      return;
    }
    setUploading(true);
    try {
      const res = await upload({
        data: { base64: await fileToBase64(file), contentType: file.type as never, scope },
      });
      setImagePath(res.path);
      setImageUrl(res.url);
    } catch (e: any) {
      toast.error("Upload failed", { description: e?.message });
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{ad ? "Edit sponsor" : "New sponsor"}</DialogTitle>
          <DialogDescription>
            Members see this exactly as previewed, labelled "Sponsored".
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ad-advertiser">Advertiser</Label>
              <Input
                id="ad-advertiser"
                value={advertiserName}
                maxLength={80}
                onChange={(e) => setAdvertiserName(e.target.value)}
                placeholder="Green Leaf Nutrition"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ad-headline">Headline ({headline.trim().length}/60)</Label>
              <Input
                id="ad-headline"
                value={headline}
                maxLength={60}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="10% off protein for members"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ad-body">Body ({body.trim().length}/160)</Label>
              <Textarea
                id="ad-body"
                rows={3}
                maxLength={160}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ad-cta-label">Button label</Label>
                <Input
                  id="ad-cta-label"
                  maxLength={24}
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  placeholder="Shop now"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ad-cta-url">Link</Label>
                <Input
                  id="ad-cta-url"
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  placeholder="https://example.com"
                />
                {urlError && <p className="text-xs text-destructive">{urlError}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ad-image">Image (16:9, PNG/JPEG/WebP, max 500KB)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="ad-image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onPickFile(f);
                  }}
                />
                {uploading ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                ) : (
                  <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </div>
              {imagePath && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline"
                  onClick={() => {
                    setImagePath(null);
                    setImageUrl(null);
                  }}
                >
                  Remove image
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Placement</Label>
                <Select value={placement} onValueChange={(v) => setPlacement(v as AdPlacement)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLACEMENTS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as AdStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ad-start">Starts</Label>
                <Input
                  id="ad-start"
                  type="date"
                  value={startsOn}
                  onChange={(e) => setStartsOn(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ad-end">Ends (optional)</Label>
                <Input
                  id="ad-end"
                  type="date"
                  value={endsOn}
                  onChange={(e) => setEndsOn(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ad-priority">Priority</Label>
                <Input
                  id="ad-priority"
                  type="number"
                  min={0}
                  max={100}
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value) || 0)}
                />
              </div>
            </div>
            {endsOn && endsOn < startsOn && (
              <p className="text-xs text-destructive">The end date cannot be before the start.</p>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.15em] text-muted-foreground">
              Member preview
            </p>
            <SponsoredCard
              ad={{
                id: "preview",
                advertiserName: advertiserName.trim() || "Advertiser",
                headline: headline.trim() || "Your headline goes here",
                body: body.trim() || null,
                imageUrl,
                ctaLabel: ctaLabel.trim() || null,
                ctaUrl: urlError ? null : ctaUrl.trim() || null,
                isPlatform: scope === "platform",
              }}
            />
            {imagePath && !imageUrl && (
              <p className="mt-2 text-xs text-muted-foreground">
                The saved image isn't previewed here — members will still see it.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canSave || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Saving…" : ad ? "Save changes" : "Create sponsor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
