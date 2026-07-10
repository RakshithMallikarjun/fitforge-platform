import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createAssessment } from "@/lib/assessments.functions";
import { uploadProgressPhoto } from "@/lib/progress.functions";

const formSchema = z.object({
  date: z.string().min(1),
  unit_system: z.enum(["metric", "imperial"]),
  weight: z.string().optional(),
  height: z.string().optional(),
  body_fat_pct: z.string().optional(),
  muscle_mass: z.string().optional(),
  chest: z.string().optional(),
  waist: z.string().optional(),
  hips: z.string().optional(),
  arms: z.string().optional(),
  thighs: z.string().optional(),
  vo2_max: z.string().optional(),
  resting_hr: z.string().optional(),
  blood_pressure: z.string().optional(),
  flexibility: z.string().optional(),
  bench_1rm: z.string().optional(),
  squat_1rm: z.string().optional(),
  deadlift_1rm: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const numOrUndef = (s?: string) => {
  if (!s || s.trim() === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

// Convert displayed value -> metric for storage
const toMetricWeight = (n: number, unit: "metric" | "imperial") =>
  unit === "imperial" ? n / 2.205 : n;
const toMetricLength = (n: number, unit: "metric" | "imperial") =>
  unit === "imperial" ? n * 2.54 : n; // inches -> cm
const toMetricHeight = (n: number, unit: "metric" | "imperial") =>
  unit === "imperial" ? n * 2.54 : n; // inches -> cm (stored as cm)

// Convert metric stored -> displayed
const fromMetricWeight = (n: number, unit: "metric" | "imperial") =>
  unit === "imperial" ? n * 2.205 : n;
const fromMetricLength = (n: number, unit: "metric" | "imperial") =>
  unit === "imperial" ? n / 2.54 : n;

export function NewAssessmentSheet({
  memberId,
  open,
  onOpenChange,
}: {
  memberId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const createFn = useServerFn(createAssessment);
  const uploadPhotoFn = useServerFn(uploadProgressPhoto);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      unit_system: "metric",
    },
  });

  const unit = form.watch("unit_system");
  const weightStr = form.watch("weight");
  const heightStr = form.watch("height");

  // Auto BMI calc for display (kg / m^2 using current display units converted to metric)
  const bmiDisplay = useMemo(() => {
    const w = numOrUndef(weightStr);
    const h = numOrUndef(heightStr);
    if (!w || !h) return "";
    const wKg = toMetricWeight(w, unit);
    const hCm = toMetricHeight(h, unit);
    if (hCm <= 0) return "";
    const m = hCm / 100;
    return (wKg / (m * m)).toFixed(1);
  }, [weightStr, heightStr, unit]);

  // When unit toggles, convert visible numbers so the underlying metric value is preserved
  const [lastUnit, setLastUnit] = useState<"metric" | "imperial">("metric");
  useEffect(() => {
    if (unit === lastUnit) return;
    const convertWeight = (s?: string) => {
      const n = numOrUndef(s);
      if (n === undefined) return s;
      // currently in lastUnit -> metric -> new unit
      const metric = toMetricWeight(n, lastUnit);
      return Number(fromMetricWeight(metric, unit).toFixed(2)).toString();
    };
    const convertLen = (s?: string) => {
      const n = numOrUndef(s);
      if (n === undefined) return s;
      const metric = toMetricLength(n, lastUnit);
      return Number(fromMetricLength(metric, unit).toFixed(2)).toString();
    };
    const v = form.getValues();
    form.reset({
      ...v,
      weight: convertWeight(v.weight),
      height: convertLen(v.height),
      chest: convertLen(v.chest),
      waist: convertLen(v.waist),
      hips: convertLen(v.hips),
      arms: convertLen(v.arms),
      thighs: convertLen(v.thighs),
      bench_1rm: convertWeight(v.bench_1rm),
      squat_1rm: convertWeight(v.squat_1rm),
      deadlift_1rm: convertWeight(v.deadlift_1rm),
    });
    setLastUnit(unit);
  }, [unit, lastUnit, form]);

  const mutation = useMutation({
    mutationFn: (payload: any) => createFn({ data: payload }),
    onSuccess: async (inserted: any) => {
      if (photoFile && inserted?.id) {
        try {
          const base64 = await fileToBase64(photoFile);
          const ext = (photoFile.name.split(".").pop() ?? "jpg").toLowerCase();
          await uploadPhotoFn({
            data: {
              member_id: memberId,
              assessment_id: inserted.id,
              taken_at: inserted.date ?? undefined,
              file_base64: base64,
              content_type: photoFile.type || "image/jpeg",
              file_ext: ext,
            },
          });
          qc.invalidateQueries({ queryKey: ["progress-photos"] });
        } catch (err: any) {
          toast.error(`Assessment saved, but photo upload failed: ${err?.message ?? "unknown error"}`);
        }
      }
      toast.success("Assessment recorded");
      qc.invalidateQueries({ queryKey: ["assessments", memberId] });
      onOpenChange(false);
      form.reset({
        date: format(new Date(), "yyyy-MM-dd"),
        unit_system: "metric",
      });
      setLastUnit("metric");
      setPhotoFile(null);
      setPhotoPreview(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save assessment"),
  });

  const onSubmit = (v: FormValues) => {
    const u = v.unit_system;
    const w = numOrUndef(v.weight);
    const h = numOrUndef(v.height);
    const mapWeight = (s?: string) => {
      const n = numOrUndef(s);
      return n === undefined ? null : Number(toMetricWeight(n, u).toFixed(3));
    };
    const mapLen = (s?: string) => {
      const n = numOrUndef(s);
      return n === undefined ? null : Number(toMetricLength(n, u).toFixed(2));
    };
    mutation.mutate({
      member_id: memberId,
      date: v.date,
      unit_system: u,
      weight: w === undefined ? null : Number(toMetricWeight(w, u).toFixed(3)),
      height: h === undefined ? null : Number(toMetricHeight(h, u).toFixed(2)),
      body_fat_pct: numOrUndef(v.body_fat_pct) ?? null,
      muscle_mass: mapWeight(v.muscle_mass),
      chest: mapLen(v.chest),
      waist: mapLen(v.waist),
      hips: mapLen(v.hips),
      arms: mapLen(v.arms),
      thighs: mapLen(v.thighs),
      vo2_max: numOrUndef(v.vo2_max) ?? null,
      resting_hr: numOrUndef(v.resting_hr) ?? null,
      blood_pressure: v.blood_pressure?.trim() || null,
      flexibility: numOrUndef(v.flexibility) ?? null,
      bench_1rm: mapWeight(v.bench_1rm),
      squat_1rm: mapWeight(v.squat_1rm),
      deadlift_1rm: mapWeight(v.deadlift_1rm),
      notes: v.notes?.trim() || null,
    });
  };

  const wU = unit === "imperial" ? "lb" : "kg";
  const lU = unit === "imperial" ? "in" : "cm";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New assessment</SheetTitle>
          <SheetDescription>Record measurements and benchmarks.</SheetDescription>
        </SheetHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-6">
          {/* Basic */}
          <Section title="Basic metrics">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date">
                <Input type="date" {...form.register("date")} />
              </Field>
              <Field label="Units">
                <Tabs value={unit} onValueChange={(v) => form.setValue("unit_system", v as any)}>
                  <TabsList className="w-full">
                    <TabsTrigger value="metric" className="flex-1">Metric</TabsTrigger>
                    <TabsTrigger value="imperial" className="flex-1">Imperial</TabsTrigger>
                  </TabsList>
                </Tabs>
              </Field>
            </div>
          </Section>

          {/* Body comp */}
          <Section title="Body composition">
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Weight (${wU})`}>
                <Input type="number" step="0.1" {...form.register("weight")} />
              </Field>
              <Field label={`Height (${lU})`}>
                <Input type="number" step="0.1" {...form.register("height")} />
              </Field>
              <Field label="BMI (auto)">
                <Input value={bmiDisplay} readOnly className="bg-muted" />
              </Field>
              <Field label="Body fat %">
                <Input type="number" step="0.1" {...form.register("body_fat_pct")} />
              </Field>
              <Field label={`Muscle mass (${wU})`}>
                <Input type="number" step="0.1" {...form.register("muscle_mass")} />
              </Field>
            </div>
          </Section>

          {/* Measurements */}
          <Section title={`Measurements (${lU})`}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Chest"><Input type="number" step="0.1" {...form.register("chest")} /></Field>
              <Field label="Waist"><Input type="number" step="0.1" {...form.register("waist")} /></Field>
              <Field label="Hips"><Input type="number" step="0.1" {...form.register("hips")} /></Field>
              <Field label="Arms"><Input type="number" step="0.1" {...form.register("arms")} /></Field>
              <Field label="Thighs"><Input type="number" step="0.1" {...form.register("thighs")} /></Field>
            </div>
          </Section>

          {/* Benchmarks */}
          <Section title="Fitness benchmarks">
            <div className="grid grid-cols-2 gap-3">
              <Field label="VO2 max"><Input type="number" step="0.1" {...form.register("vo2_max")} /></Field>
              <Field label="Resting HR (bpm)"><Input type="number" {...form.register("resting_hr")} /></Field>
              <Field label="Blood pressure"><Input placeholder="120/80" {...form.register("blood_pressure")} /></Field>
              <Field label="Flexibility (cm)"><Input type="number" step="0.1" {...form.register("flexibility")} /></Field>
            </div>
          </Section>

          {/* 1RM */}
          <Section title={`Strength 1RM (${wU})`}>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Bench"><Input type="number" step="0.5" {...form.register("bench_1rm")} /></Field>
              <Field label="Squat"><Input type="number" step="0.5" {...form.register("squat_1rm")} /></Field>
              <Field label="Deadlift"><Input type="number" step="0.5" {...form.register("deadlift_1rm")} /></Field>
            </div>
          </Section>

          {/* Notes */}
          <Section title="Notes">
            <Textarea rows={4} placeholder="Any observations…" {...form.register("notes")} />
          </Section>

          {/* Progress photo */}
          <Section title="Progress photo (optional)">
            <div className="space-y-2">
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setPhotoFile(f);
                  if (f) {
                    const url = URL.createObjectURL(f);
                    setPhotoPreview(url);
                  } else {
                    setPhotoPreview(null);
                  }
                }}
              />
              {photoPreview && (
                <div className="relative inline-block">
                  <img
                    src={photoPreview}
                    alt="Progress preview"
                    className="h-40 w-40 rounded-xl object-cover border border-border"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="absolute right-1 top-1 h-7"
                    onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                  >
                    Remove
                  </Button>
                </div>
              )}
            </div>
          </Section>

          <SheetFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save assessment"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
