/**
 * Offline mutation queue for the workout player.
 *
 * Persists pending set logs / workout completions in IndexedDB via idb-keyval
 * and flushes them when the app regains connectivity (online event,
 * visibilitychange, or SW background-sync message).
 *
 * Robustness rules:
 *  - Items are grouped by logId and replayed in order; the first failure in a
 *    group aborts the rest of that group so a workout is never finalised with
 *    an earlier set still pending.
 *  - Every item tracks an attempt count with exponential backoff.
 *  - Permanent failures (4xx / validation) are dropped straight to the
 *    dead-letter list; transient network failures retry until the threshold.
 *  - The queue is capped; the oldest entries are dead-lettered when it fills.
 */
import { get, set, del } from "idb-keyval";
import { logSet, completeWorkout } from "@/lib/workout-player.functions";

const QUEUE_KEY = "fitforge:offline-queue";
const DEAD_KEY = "fitforge:offline-dead-letter";

export const MAX_ATTEMPTS = 5;
export const MAX_QUEUE_SIZE = 500;
const BASE_BACKOFF_MS = 5_000;

export type QueuedItem = {
  id: string;
  queuedAt: number;
  attempts: number;
  nextAttemptAt: number;
  lastError?: string;
} & (
  | {
      type: "logSet";
      payload: {
        logId: string;
        exerciseId: string;
        setNumber: number;
        weight: number | null;
        reps: number | null;
        completed: boolean;
      };
    }
  | {
      type: "completeWorkout";
      payload: {
        logId: string;
        notes: string | null;
        effortRating: number | null;
        synced_offline?: boolean;
      };
    }
);

export type DeadItem = QueuedItem & { deadAt: number; reason: string };

async function readQueue(): Promise<QueuedItem[]> {
  const raw = (await get<QueuedItem[]>(QUEUE_KEY)) ?? [];
  // Tolerate items written by an older version without attempt bookkeeping.
  return raw.map((i) => ({
    ...i,
    attempts: i.attempts ?? 0,
    nextAttemptAt: i.nextAttemptAt ?? 0,
  }));
}


async function writeQueue(items: QueuedItem[]) {
  if (items.length === 0) await del(QUEUE_KEY);
  else await set(QUEUE_KEY, items);
}

export async function readDeadLetter(): Promise<DeadItem[]> {
  return (await get<DeadItem[]>(DEAD_KEY)) ?? [];
}

async function addDeadLetter(items: DeadItem[]) {
  if (items.length === 0) return;
  const existing = await readDeadLetter();
  await set(DEAD_KEY, [...existing, ...items].slice(-200));
}

export async function clearDeadLetter() {
  await del(DEAD_KEY);
}

/** Move dead-lettered items back into the queue for a manual retry. */
export async function retryDeadLetter(): Promise<number> {
  const dead = await readDeadLetter();
  if (dead.length === 0) return 0;
  const q = await readQueue();
  const revived = dead.map(({ deadAt: _d, reason: _r, ...item }) => ({
    ...item,
    attempts: 0,
    nextAttemptAt: 0,
  })) as QueuedItem[];
  await writeQueue([...q, ...revived].slice(-MAX_QUEUE_SIZE));
  await clearDeadLetter();
  return revived.length;
}

export async function enqueueLog<T extends QueuedItem["type"]>(
  type: T,
  payload: Extract<QueuedItem, { type: T }>["payload"],
): Promise<void> {
  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    payload,
    queuedAt: Date.now(),
    attempts: 0,
    nextAttemptAt: 0,
  } as QueuedItem;
  const q = await readQueue();
  q.push(item);
  if (q.length > MAX_QUEUE_SIZE) {
    const overflow = q.splice(0, q.length - MAX_QUEUE_SIZE);
    await addDeadLetter(
      overflow.map((i) => ({ ...i, deadAt: Date.now(), reason: "Queue full" })),
    );
  }
  await writeQueue(q);
}

export async function getQueueSize(): Promise<number> {
  return (await readQueue()).length;
}

export async function getDeadLetterSize(): Promise<number> {
  return (await readDeadLetter()).length;
}

/** A 4xx-style failure is permanent — retrying it will never succeed. */
function isPermanentFailure(err: unknown): boolean {
  const status = (err as { status?: number; statusCode?: number })?.status ??
    (err as { statusCode?: number })?.statusCode;
  if (typeof status === "number") return status >= 400 && status < 500 && status !== 408 && status !== 429;
  const msg = String((err as Error)?.message ?? err ?? "").toLowerCase();
  if (!msg) return false;
  if (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("timeout")) return false;
  return (
    msg.includes("forbidden") ||
    msg.includes("unauthorized") ||
    msg.includes("not found") ||
    msg.includes("invalid") ||
    msg.includes("violates") ||
    msg.includes("400") ||
    msg.includes("401") ||
    msg.includes("403") ||
    msg.includes("404") ||
    msg.includes("422")
  );
}

async function runItem(item: QueuedItem): Promise<void> {
  if (item.type === "logSet") {
    await logSet({ data: item.payload });
  } else {
    await completeWorkout({
      data: {
        logId: item.payload.logId,
        notes: item.payload.notes,
        effortRating: item.payload.effortRating,
        syncedOffline: item.payload.synced_offline ?? true,
      },
    });
  }
}

let flushing = false;

/**
 * Attempt to flush the queue. Items are replayed per workout (logId) in order;
 * the first failure in a group leaves the rest of that group queued.
 */
export async function flushQueue(): Promise<{ ok: number; failed: number; dead: number }> {
  if (flushing) return { ok: 0, failed: 0, dead: 0 };
  flushing = true;
  let ok = 0;
  let failed = 0;
  const dead: DeadItem[] = [];
  try {
    const q = await readQueue();
    if (q.length === 0) return { ok: 0, failed: 0, dead: 0 };

    // Preserve enqueue order within each workout group.
    const groups = new Map<string, QueuedItem[]>();
    for (const item of q) {
      const key = item.payload.logId;
      const list = groups.get(key) ?? [];
      list.push(item);
      groups.set(key, list);
    }

    const now = Date.now();
    const remaining: QueuedItem[] = [];

    for (const [, items] of groups) {
      let blocked = false;
      for (const item of items) {
        if (blocked) {
          remaining.push(item);
          continue;
        }
        if (item.nextAttemptAt > now) {
          remaining.push(item);
          blocked = true; // keep group ordering intact
          continue;
        }
        try {
          await runItem(item);
          ok += 1;
        } catch (err) {
          failed += 1;
          blocked = true;
          const attempts = item.attempts + 1;
          const message = String((err as Error)?.message ?? err).slice(0, 200);
          if (isPermanentFailure(err) || attempts >= MAX_ATTEMPTS) {
            dead.push({
              ...item,
              attempts,
              lastError: message,
              deadAt: Date.now(),
              reason: isPermanentFailure(err) ? `Rejected: ${message}` : `Gave up after ${attempts} attempts`,
            });
          } else {
            remaining.push({
              ...item,
              attempts,
              lastError: message,
              nextAttemptAt: Date.now() + BASE_BACKOFF_MS * 2 ** (attempts - 1),
            });
          }
        }
      }
    }

    await writeQueue(remaining.slice(-MAX_QUEUE_SIZE));
    await addDeadLetter(dead);
  } finally {
    flushing = false;
  }
  return { ok, failed, dead: dead.length };
}
