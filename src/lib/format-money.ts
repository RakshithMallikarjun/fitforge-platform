/**
 * Currency rendering from the gym's own `gyms.currency` (ISO 4217 code).
 * Never hardcode a symbol — gyms on this platform bill in their own currency.
 */
export function formatMoney(
  amount: number | string | null | undefined,
  currency: string | null | undefined,
): string {
  if (amount == null) return "—";
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  const code = (currency ?? "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(code)) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: code,
        currencyDisplay: "narrowSymbol",
        maximumFractionDigits: 2,
      }).format(n);
    } catch {
      /* unknown currency code — fall through */
    }
  }
  return code ? `${code} ${n.toLocaleString()}` : n.toLocaleString();
}
