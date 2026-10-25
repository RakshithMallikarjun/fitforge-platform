/**
 * Per-set state helpers for the workout player.
 *
 * Every set row owns its own values. Editing set N must never change any
 * other set — an earlier version carried a typed value forward into all
 * later untouched rows, which corrupted logs (Set 1's numbers appeared in
 * Set 2, 3, …). These helpers are pure so that rule is unit-tested.
 */

export type SetState = {
  weight: string;
  reps: string;
  seconds: string;
  done: boolean;
  touched?: boolean;
};

export function emptySet(): SetState {
  return { weight: "", reps: "", seconds: "", done: false };
}

/** Patch exactly one row; all other rows are returned untouched. */
export function applySetPatch(
  rows: SetState[],
  idx: number,
  patch: Partial<SetState>,
): SetState[] {
  return rows.map((r, i) => (i === idx ? { ...r, ...patch, touched: true } : r));
}

/**
 * Append a new independent row. The previous set's numbers are copied as a
 * one-off initial value (not linked): editing either row afterwards never
 * affects the other.
 */
export function addSetRow(rows: SetState[]): SetState[] {
  const prev = rows[rows.length - 1];
  const seed: SetState = prev
    ? { weight: prev.weight, reps: prev.reps, seconds: prev.seconds, done: false }
    : emptySet();
  return [...rows, seed];
}

/**
 * Remove exactly one row. Remaining rows keep their own values; their
 * position (set number) shifts but the values move with the row.
 */
export function removeSetRow(rows: SetState[], idx: number): SetState[] {
  return rows.filter((_, i) => i !== idx);
}

/**
 * One-off "Use last" fill: copies the previous session's values for this
 * set number into this row only.
 */
export function fillFromPrevious(
  rows: SetState[],
  idx: number,
  prev: { weight: number | null; reps: number | null; duration_seconds: number | null },
): SetState[] {
  return rows.map((r, i) =>
    i === idx
      ? {
          ...r,
          weight: prev.weight != null ? String(prev.weight) : "",
          reps: prev.reps != null ? String(prev.reps) : "",
          seconds: prev.duration_seconds != null ? String(prev.duration_seconds) : "",
          touched: true,
        }
      : r,
  );
}
