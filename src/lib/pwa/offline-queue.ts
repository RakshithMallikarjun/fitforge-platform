/**
 * Offline mutation queue for the workout player.
 *
 * Persists pending set logs / workout completions in IndexedDB via idb-keyval
 * and flushes them when the app regains connectivity (online event,
 * visibilitychange, or SW background-sync message).
 */
import { get, set, del } from "idb-keyval";
import { logSet, completeWorkout } from "@/lib/workout-player.functions";

const QUEUE_KEY = "fitforge:offline-queue";

export type QueuedItem =
  | {
      id: string;
      type: "logSet";
      payload: {
        logId: string;
        exerciseId: string;
        setNumber: number;
        weight: number | null;
        reps: number | null;
        completed: boolean;
      };
      queuedAt: number;
    }
  | {
      id: string;
      type: "completeWorkout";
      payload: {
        logId: string;
        notes: string | null;
        effortRating: number | null;
        synced_offline?: boolean;
      };
      queuedAt: number;
    };

async function readQueue(): Promise<QueuedItem[]> {
  return (await get<QueuedItem[]>(QUEUE_KEY)) ?? [];
}

async function writeQueue(items: QueuedItem[]) {
  if (items.length === 0) await del(QUEUE_KEY);
  else await set(QUEUE_KEY, items);
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
  } as QueuedItem;
  const q = await readQueue();
  q.push(item);
  await writeQueue(q);
}

export async function getQueueSize(): Promise<number> {
  return (await readQueue()).length;
}

let flushing = false;

/**
 * Attempt to flush the queue. Successful items are removed; failures stay for
 * the next attempt. Runs sequentially so we don't hammer the server.
 */
export async function flushQueue(): Promise<{ ok: number; failed: number }> {
  if (flushing) return { ok: 0, failed: 0 };
  flushing = true;
  let ok = 0;
  let failed = 0;
  try {
    const q = await readQueue();
    if (q.length === 0) return { ok: 0, failed: 0 };
    const remaining: QueuedItem[] = [];
    for (const item of q) {
      try {
        if (item.type === "logSet") {
          await logSet({ data: item.payload });
        } else {
          await completeWorkout({
            data: {
              logId: item.payload.logId,
              notes: item.payload.notes,
              effortRating: item.payload.effortRating,
            },
          });
        }
        ok += 1;
      } catch {
        remaining.push(item);
        failed += 1;
      }
    }
    await writeQueue(remaining);
  } finally {
    flushing = false;
  }
  return { ok, failed };
}
