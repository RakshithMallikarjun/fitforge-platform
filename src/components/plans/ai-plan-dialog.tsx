import { plural } from "@/lib/copy";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  generatePlanDraft,
  getAiPlanPrefill,
  getTrainingProfile,
  listGymEquipment,
  saveTrainingProfile,
  type PlanDraft,
} from "@/lib/plan-ai.functions";

type Experience = "beginner" | "intermediate" | "advanced";

export function AiPlanDialog({
  open,
  onOpenChange,
  memberId,
  memberName,
  onDraft,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  memberId: string;
  memberName?: string;
  onDraft: (draft: PlanDraft) => void;
}) {
  const [goals, setGoals] = useState("");
  const [limitations, setLimitations] = useState("");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [daysPerWeek, setDaysPerWeek] = useState("3");
  const [sessionMinutes, setSessionMinutes] = useState("60");
  const [experience, setExperience] = useState<Experience>("beginner");
  const [allowAdvanced, setAllowAdvanced] = useState(false);

  const prefill = useQuery({
    enabled: open && !!memberId,
    queryKey: ["ai-plan-prefill", memberId],
    queryFn: () => getAiPlanPrefill({ data: { memberId } }),
  });

  const profile = useQuery({
    enabled: open && !!memberId,
    queryKey: ["training-profile", memberId],
    queryFn: () => getTrainingProfile({ data: { memberId } }),
  });

  const equipmentOptions = useQuery({
    enabled: open,
    queryKey: ["gym-equipment"],
    queryFn: () => listGymEquipment(),
  });

  // Pre-fill from the saved profile so a trainer types this only once.
  // Saved training profile wins; otherwise fall back to the member's own profile.
  useEffect(() => {
    if (!open || profile.isLoading || prefill.isLoading) return;
    const p = profile.data;
    const f = prefill.data;
    setGoals(p?.goals?.trim() || f?.goals || "");
    setLimitations(p?.limitations?.trim() || f?.limitations || "");
    setEquipment(p?.equipment ?? []);
    setDaysPerWeek(String(p?.days_per_week ?? 3));
    setSessionMinutes(String(p?.session_minutes ?? 60));
    setExperience((f?.experience as Experience) ?? (p?.experience as Experience) ?? "beginner");
  }, [open, profile.data, prefill.data, profile.isLoading, prefill.isLoading]);

  const payload = () => ({
    memberId,
    goals: goals.trim(),
    limitations: limitations.trim(),
    equipment,
    daysPerWeek: Number(daysPerWeek) || 3,
    sessionMinutes: Number(sessionMinutes) || 60,
    experience,
    allowAdvanced: experience === "beginner" ? allowAdvanced : undefined,
  });

  const generate = useMutation({
    mutationFn: async () => {
      const data = payload();
      // Save first so the inputs survive even if generation fails.
      const { allowAdvanced: _a, ...profileData } = data;
      await saveTrainingProfile({ data: profileData }).catch(() => undefined);
      return generatePlanDraft({ data });
    },
    onSuccess: (draft) => {
      onDraft(draft);
      onOpenChange(false);
      toast.success("Draft ready", {
        description: `${plural(draft.days.length, "day")} loaded — review before saving.`,
      });
    },
  });

  const canGenerate = goals.trim().length >= 3 && !generate.isPending;

  const toggleEquipment = (value: string) =>
    setEquipment((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Generate plan with AI
          </DialogTitle>
          <DialogDescription>
            {memberName
              ? `Tell us about ${memberName} and we'll draft a week of training you can edit before saving.`
              : "Nothing is saved to the member until you press save in the builder."}
          </DialogDescription>
        </DialogHeader>

        {profile.isLoading || prefill.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            {prefill.data?.assessment && (
              <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
                Latest assessment ({prefill.data.assessment.date}):{" "}
                {prefill.data.assessment.summary}. It's included in the draft.
              </p>
            )}
            <div>
              <Label htmlFor="ai-goals">Goals</Label>
              <Textarea
                id="ai-goals"
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                placeholder="e.g. lose 6 kg and build upper-body strength"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="ai-limits">Limitations or injuries</Label>
              <Textarea
                id="ai-limits"
                value={limitations}
                onChange={(e) => setLimitations(e.target.value)}
                placeholder="e.g. left knee pain, no overhead pressing"
                rows={2}
              />
            </div>

            <div>
              <Label>Available equipment</Label>
              {equipmentOptions.isLoading ? (
                <Skeleton className="mt-2 h-8 w-full" />
              ) : equipmentOptions.isError ? (
                <p className="mt-2 text-sm text-destructive">
                  Equipment list unavailable — the plan will use your whole library.
                </p>
              ) : (equipmentOptions.data ?? []).length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No equipment tags in your exercise library yet — the plan will use everything.
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {(equipmentOptions.data ?? []).map((item) => {
                    const active = equipment.includes(item);
                    return (
                      <button key={item} type="button" onClick={() => toggleEquipment(item)}>
                        <Badge variant={active ? "default" : "outline"} className="cursor-pointer">
                          {item}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ai-days">Days per week</Label>
                <Input
                  id="ai-days"
                  type="number"
                  min={1}
                  max={7}
                  value={daysPerWeek}
                  onChange={(e) => setDaysPerWeek(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="ai-mins">Session minutes</Label>
                <Input
                  id="ai-mins"
                  type="number"
                  min={15}
                  max={180}
                  step={5}
                  value={sessionMinutes}
                  onChange={(e) => setSessionMinutes(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Experience</Label>
              <Select value={experience} onValueChange={(v) => setExperience(v as Experience)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
              {experience === "beginner" && (
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={allowAdvanced}
                    onCheckedChange={(v) => setAllowAdvanced(v === true)}
                  />
                  Allow advanced exercises
                </label>
              )}
            </div>

            {generate.isError && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
                <p className="font-medium text-destructive">Couldn't generate a plan</p>
                <p className="mt-1 text-muted-foreground">
                  {(generate.error as Error)?.message ?? "Something went wrong."}
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canGenerate} onClick={() => generate.mutate()}>
            {generate.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…
              </>
            ) : generate.isError ? (
              "Try again"
            ) : (
              "Generate draft"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
