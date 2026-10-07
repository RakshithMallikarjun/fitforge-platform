import { useState } from "react";
import { formatServerError } from "@/lib/format-error";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { EQUIPMENT, MUSCLE_GROUPS, isYoutubeUrl, normaliseTags } from "@/lib/exercise-taxonomy";
import {
  createExercise,
  updateExercise,
  getYoutubeThumbnail,
  normaliseExerciseName,
  type ExerciseRow,
} from "@/lib/exercises.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: ExerciseRow | null;
  /** Normalised names of global exercises, so we can warn before duplicating one. */
  globalNames?: Set<string>;
};

function ChipSelect({
  value,
  onChange,
  options,
  kind,
  label,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options: readonly string[];
  kind: "muscle" | "equipment";
  label: string;
}) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const all = Array.from(new Set([...options, ...value]));
  const toggle = (t: string) =>
    onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t]);
  const addCustom = () => {
    const next = normaliseTags([...value, text], kind);
    onChange(next);
    setText("");
    setAdding(false);
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {all.map((t) => {
          const on = value.includes(t);
          return (
            <button
              key={t}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(t)}
              className={
                "rounded-full border px-2.5 py-1 text-xs capitalize transition " +
                (on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground")
              }
            >
              {t}
            </button>
          );
        })}
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3 w-3" /> Add custom
          </button>
        )}
      </div>
      {adding && (
        <div className="mt-2 flex gap-2">
          <Input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder="One per entry; commas split"
          />
          <Button type="button" size="sm" variant="outline" onClick={addCustom}>
            Add
          </Button>
        </div>
      )}
    </div>
  );
}

export function ExerciseFormDialog({ open, onOpenChange, initial, globalNames }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [videoUrl, setVideoUrl] = useState(initial?.video_url ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(initial?.thumbnail_url ?? "");
  const [muscleGroups, setMuscleGroups] = useState<string[]>(
    normaliseTags(initial?.muscle_groups ?? [], "muscle"),
  );
  const [equipment, setEquipment] = useState<string[]>(
    normaliseTags(initial?.equipment ?? [], "equipment"),
  );
  const [videoErr, setVideoErr] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<string>(initial?.difficulty ?? "beginner");

  const duplicatesGlobal =
    !initial?.id && !!name.trim() && !!globalNames?.has(normaliseExerciseName(name));

  const save = useMutation({
    mutationFn: async () => {
      const finalThumb =
        thumbnailUrl?.trim() || (videoUrl ? getYoutubeThumbnail(videoUrl) : "") || null;
      const payload = {
        name,
        description: description || null,
        video_url: videoUrl.trim() || null,
        thumbnail_url: finalThumb,
        muscle_groups: muscleGroups,
        equipment,
        difficulty: difficulty as "beginner" | "intermediate" | "advanced",
      };
      if (initial?.id) {
        return updateExercise({ data: { id: initial.id, patch: payload } });
      }
      return createExercise({ data: payload });
    },
    onSuccess: () => {
      toast.success(initial ? "Exercise updated" : "Exercise added");
      qc.invalidateQueries({ queryKey: ["exercises"] });
      onOpenChange(false);
    },
    onError: (e: any) => {
      const msg = formatServerError(e);
      if (/youtube/i.test(msg)) setVideoErr("Use a YouTube link");
      else toast.error("Save failed", { description: msg });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit exercise" : "Add exercise"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
            {duplicatesGlobal && (
              <p className="mt-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                “{name.trim()}” already exists in the global library. Saving creates a duplicate for
                your gym — consider using the global exercise instead.
              </p>
            )}
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description ?? ""} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label>YouTube Video URL (optional)</Label>
              <Input
                value={videoUrl ?? ""}
                onChange={(e) => {
                  setVideoUrl(e.target.value);
                  setVideoErr(null);
                }}
                aria-invalid={!!videoErr}
                placeholder="https://www.youtube.com/watch?v=..."
              />
              {videoErr && <p className="mt-1 text-xs text-destructive">{videoErr}</p>}
              <p className="mt-1 text-[11px] text-muted-foreground">
                Paste a YouTube video URL for the exercise demonstration, e.g.
                https://www.youtube.com/watch?v=… — leave blank to use auto-search.
              </p>
            </div>
            <div>
              <Label>Thumbnail URL (optional)</Label>
              <Input value={thumbnailUrl ?? ""} onChange={(e) => setThumbnailUrl(e.target.value)} />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Leave blank to auto-generate from YouTube URL.
              </p>
            </div>
          </div>
          <div>
            <Label>Muscle groups</Label>
            <ChipSelect
              label="Muscle groups"
              kind="muscle"
              options={MUSCLE_GROUPS}
              value={muscleGroups}
              onChange={setMuscleGroups}
            />
          </div>
          <div>
            <Label>Equipment</Label>
            <ChipSelect
              label="Equipment"
              kind="equipment"
              options={EQUIPMENT}
              value={equipment}
              onChange={setEquipment}
            />
          </div>
          <div>
            <Label>Difficulty</Label>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (videoUrl.trim() && !isYoutubeUrl(videoUrl)) {
                setVideoErr("Use a YouTube link");
                return;
              }
              save.mutate();
            }}
            disabled={!name || save.isPending}
          >
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
