import { useEffect, useRef } from "react";

/**
 * Remembers the control that opened a dialog/sheet so focus can go back to it
 * on close. Radix restores focus to whatever was focused at open time, which is
 * a removed menu item when a dialog opens from a dropdown — focus then falls to
 * <body>. We record the last interacted control outside menus and dialogs.
 */
let lastOpener: HTMLElement | null = null;

const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"]';

function record(e: Event) {
  const t = e.target as HTMLElement | null;
  if (!t || typeof t.closest !== "function") return;
  if (t.closest('[role="menu"], [role="dialog"], [role="alertdialog"], [role="listbox"]')) return;
  const el = t.closest(FOCUSABLE) as HTMLElement | null;
  if (el) lastOpener = el;
}

if (typeof document !== "undefined") {
  document.addEventListener("pointerdown", record, true);
  document.addEventListener("keydown", record, true);
  document.addEventListener("focusin", record, true);
}

function restore(el: HTMLElement | null) {
  if (el && el.isConnected) {
    el.focus({ preventScroll: true });
    return true;
  }
  return false;
}

/** Returns an onCloseAutoFocus handler that focuses the opener, also on unmount. */
export function useReturnFocus(userHandler?: (e: Event) => void) {
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const active = document.activeElement as HTMLElement | null;
    opener.current =
      active && active !== document.body && !active.closest('[role="menu"]') ? active : lastOpener;
    const el = opener.current;
    return () => {
      // Dialogs rendered only while open unmount instead of closing.
      setTimeout(() => {
        if (document.activeElement === document.body || !document.activeElement) restore(el);
      }, 0);
    };
  }, []);
  return (e: Event) => {
    userHandler?.(e);
    if (e.defaultPrevented) return;
    e.preventDefault();
    if (!restore(opener.current)) restore(lastOpener);
  };
}
