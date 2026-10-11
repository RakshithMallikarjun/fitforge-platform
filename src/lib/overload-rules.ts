/** Rule-based next targets for progressive overload. Pure, no I/O. */
export type Tracking = "weight_reps" | "reps" | "time";

const PLATE = 2.5;
export const roundToPlate = (n: number) => Math.round(n / PLATE) * PLATE;

export type RuleTarget = {
  suggestedWeight: number | null;
  suggestedReps: number | null;
  suggestedSeconds: number | null;
  reasoning: string;
};

/** Never returns the same weight × reps as the current best. Null when there is no history. */
export function ruleTarget(input: {
  name: string;
  tracking: Tracking;
  best: { weight: number; reps: number } | null;
  bestReps: number | null;
  bestSeconds: number | null;
}): RuleTarget | null {
  const { name, tracking } = input;
  if (tracking === "time") {
    if (!input.bestSeconds) return null;
    const next = input.bestSeconds + 5;
    return {
      suggestedWeight: null,
      suggestedReps: null,
      suggestedSeconds: next,
      reasoning: `Your best ${name} hold was ${input.bestSeconds} s. Aim for ${next} s next time.`,
    };
  }
  if (tracking === "reps" || !input.best) {
    const reps = input.best?.reps ?? input.bestReps;
    if (!reps) return null;
    return {
      suggestedWeight: null,
      suggestedReps: reps + 1,
      suggestedSeconds: null,
      reasoning: `Your best ${name} set was ${reps} reps. One more rep is a good next step.`,
    };
  }
  const { weight, reps } = input.best;
  const bumped = roundToPlate(weight * 1.025);
  const desc = `Your best ${name} set was ${weight} kg × ${reps}.`;
  if (bumped > weight) {
    return {
      suggestedWeight: bumped,
      suggestedReps: Math.max(1, reps - 1),
      suggestedSeconds: null,
      reasoning: `${desc} A small increase of about 2.5% is a good next step.`,
    };
  }
  return {
    suggestedWeight: weight,
    suggestedReps: reps + 1,
    suggestedSeconds: null,
    reasoning: `${desc} Keep the weight and add one rep.`,
  };
}

/** Member-facing text only: drop anything that looks like an error or raw data. */
export function cleanReasoning(text: string | null | undefined): string | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  if (/ai unavailable|error|[{}[\]]|"code"|too_small|heuristic|undefined|null/i.test(t)) return null;
  return t.slice(0, 300);
}
