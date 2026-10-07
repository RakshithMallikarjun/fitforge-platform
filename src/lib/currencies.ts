/** ISO 4217 codes offered in billing dropdowns. */
export const CURRENCIES = [
  "INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD", "NZD", "ZAR",
  "LKR", "NPR", "BDT", "PKR", "MYR", "IDR", "PHP", "THB", "JPY", "SAR", "QAR", "KWD", "OMR", "BHD",
] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];
