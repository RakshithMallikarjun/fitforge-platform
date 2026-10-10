/** Pure goal progress maths shared by Progress › Goals and Profile › My goals. */
export type GoalType = "strength" | "body" | "attendance" | "custom";
export type GoalDirection = "up" | "down";
export type GoalStatus = "achieved" | "overdue" | "in_progress";

export const BODY_METRICS = {
  weight: { label: "Weight", unit: "kg", direction: "down" },
  body_fat_pct: { label: "Body fat", unit: "%", direction: "down" },
  muscle_mass: { label: "Muscle mass", unit: "kg", direction: "up" },
  waist: { label: "Waist", unit: "cm", direction: "down" },
  chest: { label: "Chest", unit: "cm", direction: "up" },
  hips: { label: "Hips", unit: "cm", direction: "down" },
  arms: { label: "Arms", unit: "cm", direction: "up" },
  thighs: { label: "Thighs", unit: "cm", direction: "up" },
} as const;
export type BodyMetric = keyof typeof BODY_METRICS;

export function goalPercent(
  current: number | null,
  target: number | null,
  direction: GoalDirection,
  start: number | null,
): number {
  if (current == null || target == null) return 0;
  let pct: number;
  if (direction === "up") {
    if (target <= 0) return 0;
    pct = (current / target) * 100;
  } else {
    if (current <= target) return 100;
    const from = start != null && start > target ? start : null;
    if (from == null) return 0;
    pct = ((from - current) / (from - target)) * 100;
  }
  return Math.round(Math.min(100, Math.max(0, pct)));
}

export function isGoalMet(current: number | null, target: number | null, direction: GoalDirection) {
  if (current == null || target == null) return false;
  return direction === "up" ? current >= target : current <= target;
}

export function goalStatus(opts: {
  current: number | null;
  target: number | null;
  direction: GoalDirection;
  targetDate: string | null;
  achievedAt: string | null;
  today: string;
}): GoalStatus {
  if (opts.achievedAt || isGoalMet(opts.current, opts.target, opts.direction)) return "achieved";
  if (opts.targetDate && opts.targetDate < opts.today) return "overdue";
  return "in_progress";
}
