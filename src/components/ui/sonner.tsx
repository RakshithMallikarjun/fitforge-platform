import { useEffect, useRef } from "react";
import { Toaster as Sonner, toast, useSonner } from "sonner";
import { notificationDeadline } from "@/lib/notification-deadline";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { toasts } = useSonner();
  const deadlines = useRef(new Map<string | number, ReturnType<typeof setTimeout>>());
  // Sonner pauses its internal clock on hover. Long errors also have a wall-clock deadline.
  useEffect(() => {
    const active = new Set(toasts.map((item) => item.id));
    for (const [id, timer] of deadlines.current) {
      if (!active.has(id)) {
        clearTimeout(timer);
        deadlines.current.delete(id);
      }
    }
    for (const item of toasts) {
      const duration = notificationDeadline(item.type, item.duration ?? props.toastOptions?.duration ?? props.duration);
      if (duration === null || deadlines.current.has(item.id)) continue;
      deadlines.current.set(item.id, setTimeout(() => toast.dismiss(item.id), duration));
    }
  }, [toasts, props.duration, props.toastOptions?.duration]);
  useEffect(() => () => {
    for (const timer of deadlines.current.values()) clearTimeout(timer);
  }, []);
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
