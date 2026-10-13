/**
 * WCAG 2.1 contrast helpers for gym brand colours. A gym can pick any hex;
 * these helpers nudge it just enough that brand-coloured text and buttons
 * stay at or above 4.5:1 on the light and dark surfaces.
 */
export const MIN_CONTRAST = 4.5;
export const LIGHT_SURFACE = "#ffffff";
export const LIGHT_BACKGROUND = "#f8fafc";
/** Darkest brand tint used behind brand text (active nav, accent chips). */
export const LIGHT_TINT = "#e6ebef";
/** Approximation of the dark theme card surface (oklch 0.22 0.02 260). */
export const DARK_SURFACE = "#1e222c";

function parse(hex: string): [number, number, number] | null {
  const h = hex.trim().replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

function toHex([r, g, b]: number[]) {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}

export function luminance(hex: string): number {
  const rgb = parse(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function mix(hex: string, target: [number, number, number], t: number) {
  const rgb = parse(hex)!;
  return toHex(rgb.map((v, i) => v + (target[i] - v) * t));
}

/** Darken (toward black) until the colour reaches 4.5:1 against every given surface. */
export function darkenForContrast(hex: string, surfaces: string[] = [LIGHT_SURFACE, LIGHT_BACKGROUND, LIGHT_TINT]) {
  if (!parse(hex)) return hex;
  const ok = (c: string) => surfaces.every((s) => contrastRatio(c, s) >= MIN_CONTRAST);
  for (let t = 0; t <= 1.0001; t += 0.02) {
    const c = mix(hex, [0, 0, 0], t);
    if (ok(c)) return c;
  }
  return "#000000";
}

/** Lighten (toward white) until the colour reaches 4.5:1 against the dark surface. */
export function lightenForContrast(hex: string, surface: string = DARK_SURFACE) {
  if (!parse(hex)) return hex;
  for (let t = 0; t <= 1.0001; t += 0.02) {
    const c = mix(hex, [255, 255, 255], t);
    if (contrastRatio(c, surface) >= MIN_CONTRAST) return c;
  }
  return "#ffffff";
}

/** Text colour (white or near-black) with the higher contrast on the given fill. */
export function readableOn(hex: string): string {
  return contrastRatio(hex, "#ffffff") >= contrastRatio(hex, "#0f172a") ? "#ffffff" : "#0f172a";
}

/** Accessible brand palette for light and dark themes. */
export function accessibleBrand(hex: string) {
  const light = darkenForContrast(hex);
  const dark = lightenForContrast(hex);
  return {
    light,
    lightForeground: readableOn(light),
    dark,
    darkForeground: readableOn(dark),
  };
}
