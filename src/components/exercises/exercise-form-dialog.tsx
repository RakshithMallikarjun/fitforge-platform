import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { createExercise, updateExercise, getYoutubeThumbnail, type ExerciseRow } from "@/lib/exercises.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: ExerciseRow | null;
};

function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [text, setText] = useState("");
  const add = () => {
    const t = text.trim().toLowerCase();
    if (!t) return;
    if (!value.includes(t)) onChange([...value, t]);
    setText("");
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {value.map((t) => (
          <Badge key={t} variant="secondary" className="gap-1">
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))}>
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Input
        className="mt-2"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder={placeholder}
      />
    </div>
  );
}

export function ExerciseFormDialog({ open, onOpenChange, initial }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [videoUrl, setVideoUrl] = useState(initial?.video_url ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(initial?.thumbnail_url ?? "");
  const [muscleGroups, setMuscleGroups] = useState<string[]>(initial?.muscle_groups ?? []);
  const [equipment, setEquipment] = useState<string[]>(initial?.equipment ?? []);
  const [difficulty, setDifficulty] = useState<string>(initial?.difficulty ?? "beginner");

  const save = useMutation({
    mutationFn: async () => {
      const finalThumb = thumbnailUrl?.trim() || (videoUrl ? getYoutubeThumbnail(videoUrl) : "") || null;
      const payload = {
        name,
        description: description || null,
        video_url: videoUrl || null,
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
    onError: (e: any) => toast.error("Save failed", { description: e?.message }),
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
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description ?? ""} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label>YouTube Video URL (optional)</Label>
              <Input value={videoUrl ?? ""} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
              <p className="mt-1 text-[11px] text-muted-foreground">Paste a YouTube video URL for the exercise demonstration, e.g. https://www.youtube.com/watch?v=… — leave blank to use auto-search.</p>
            </div>
            <div>
              <Label>Thumbnail URL (optional)</Label>
              <Input value={thumbnailUrl ?? ""} onChange={(e) => setThumbnailUrl(e.target.value)} />
              <p className="mt-1 text-[11px] text-muted-foreground">Leave blank to auto-generate from YouTube URL.</p>
            </div>
          </div>
          <div>
            <Label>Muscle groups</Label>
            <TagInput value={muscleGroups} onChange={setMuscleGroups} placeholder="chest, back…" />
          </div>
          <div>
            <Label>Equipment</Label>
            <TagInput value={equipment} onChange={setEquipment} placeholder="barbell, dumbbells…" />
          </div>
          <div>
            <Label>Difficulty</Label>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!name || save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
