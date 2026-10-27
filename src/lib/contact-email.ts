export function emailLinks(to: string | null | undefined, subject = "", body = "") {
  const email = to?.trim() ?? "";
  // A contact is one mailbox, never a header or a list of recipients.
  if (!/^[^\s@,;?&#]+@[^\s@,;?&#]+\.[^\s@,;?&#]+$/.test(email)) return null;
  return {
    email,
    mailto: `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    gmail: `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  };
}

export const MAIL_APP_WAIT_MS = 1500;

/** Mailto has no success API; leaving/focusing another app suppresses the fallback. */
export function watchMailApp(onFallback: () => void) {
  const cancel = () => {
    window.clearTimeout(timer);
    window.removeEventListener("blur", cancel);
    document.removeEventListener("visibilitychange", visibility);
  };
  const visibility = () => {
    if (document.visibilityState === "hidden") cancel();
  };
  const timer = window.setTimeout(() => {
    cancel();
    onFallback();
  }, MAIL_APP_WAIT_MS);
  window.addEventListener("blur", cancel);
  document.addEventListener("visibilitychange", visibility);
  return cancel;
}
