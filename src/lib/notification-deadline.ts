/** Long finite errors expire on wall-clock time, independently of pointer hover. */
export function notificationDeadline(
  type: string | undefined,
  duration: number | undefined,
): number | null {
  return type === "error" && duration !== undefined && duration > 8000 && Number.isFinite(duration)
    ? duration
    : null;
}
