import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type GymTheme = {
  primaryColor: string;     // hex
  logoUrl: string | null;
  fontFamily: string;       // CSS font family
  name: string;
};

const DEFAULT_THEME: GymTheme = {
  primaryColor: "#059669",
  logoUrl: null,
  fontFamily: "Satoshi",
  name: "FitForge",
};

type Ctx = {
  theme: GymTheme;
  setTheme: (t: Partial<GymTheme>) => void;
};

const ThemeCtx = createContext<Ctx>({ theme: DEFAULT_THEME, setTheme: () => {} });

/** Convert "#RRGGBB" to oklch CSS string. Falls back to the hex if anything fails. */
function hexToOklch(hex: string): string {
  try {
    const h = hex.replace("#", "");
    const r = parseInt(h.substring(0, 2), 16) / 255;
    const g = parseInt(h.substring(2, 4), 16) / 255;
    const b = parseInt(h.substring(4, 6), 16) / 255;
    // sRGB -> linear
    const f = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const lr = f(r), lg = f(g), lb = f(b);
    // linear -> oklab
    const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
    const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
    const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    const C = Math.sqrt(a * a + bb * bb);
    const H = ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
    return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(1)})`;
  } catch {
    return hex;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<GymTheme>(DEFAULT_THEME);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.style.setProperty("--primary", hexToOklch(theme.primaryColor));
    root.style.setProperty("--ring", hexToOklch(theme.primaryColor));
    root.style.setProperty("--font-body", `"${theme.fontFamily}", ui-sans-serif, system-ui, sans-serif`);
  }, [theme]);

  const setTheme = useCallback((t: Partial<GymTheme>) => {
    setThemeState((prev) => ({ ...prev, ...t }));
  }, []);

  const value = useMemo<Ctx>(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
