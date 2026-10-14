import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CloudOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  getPendingSessionCount,
  QUEUE_EVENT,
  SYNCED_EVENT,
} from "@/lib/pwa/offline-queue";
import { plural } from "@/lib/copy";

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const f = () => setOnline(navigator.onLine);
    f();
    window.addEventListener("online", f);
    window.addEventListener("offline", f);
    return () => {
      window.removeEventListener("online", f);
      window.removeEventListener("offline", f);
    };
  }, []);
  return online;
}

/** Workouts finished on this device that haven't reached the server yet. */
export function usePendingSessions() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const f = () => void getPendingSessionCount().then(setN).catch(() => {});
    f();
    window.addEventListener(QUEUE_EVENT, f);
    return () => window.removeEventListener(QUEUE_EVENT, f);
  }, []);
  return n;
}

/** Calm offline notice + "Synced" confirmation that refreshes History and Strength. */
export function OfflineSyncStatus() {
  const online = useOnline();
  const qc = useQueryClient();
  useEffect(() => {
    const onSynced = () => {
      toast.success("Synced");
      void qc.invalidateQueries();
    };
    window.addEventListener(SYNCED_EVENT, onSynced);
    return () => window.removeEventListener(SYNCED_EVENT, onSynced);
  }, [qc]);
  if (online) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-muted px-4 py-1.5 text-xs font-medium text-foreground shadow-sm"
      style={{ paddingTop: "max(0.375rem, env(safe-area-inset-top))" }}
    >
      <CloudOff className="h-3.5 w-3.5" aria-hidden="true" />
      You're offline — workouts you log are saved on this device.
    </div>
  );
}

/** Pending-sync line for Home and Workouts; renders nothing when the queue is empty. */
export function PendingSyncNotice() {
  const n = usePendingSessions();
  if (!n) return null;
  return (
    <p
      role="status"
      className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2 text-xs text-foreground"
    >
      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
      {plural(n, "workout")} saved on this device — will sync when you're back online.
    </p>
  );
}
