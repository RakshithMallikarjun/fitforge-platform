/** One join-code format: 8 chars from an unambiguous uppercase alphabet, shown as "ABCD EFGH". */
export const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const JOIN_CODE_LENGTH = 8;

export function generateJoinCode(): string {
  const out: string[] = [];
  const buf = new Uint8Array(1);
  while (out.length < JOIN_CODE_LENGTH) {
    crypto.getRandomValues(buf);
    // 256 is exactly 8 × 32, so modulo is unbiased.
    out.push(JOIN_CODE_ALPHABET[buf[0] % JOIN_CODE_ALPHABET.length]);
  }
  return out.join("");
}

/** Strip spaces/dashes and upper-case, so pasted or typed codes compare equal. */
export function normalizeJoinCode(code: string): string {
  return code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function formatJoinCode(code: string | null | undefined): string {
  const c = normalizeJoinCode(code ?? "");
  return c.length === JOIN_CODE_LENGTH ? `${c.slice(0, 4)} ${c.slice(4)}` : c;
}
