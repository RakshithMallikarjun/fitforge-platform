import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type GymTheme = {
  primaryColor: string;     // hex
  secondaryColor: string | null; // hex
  logoUrl: string | null;
  fontFamily: string;       // CSS font family
  name: string;
  supportEmail: string | null;
  supportPhone: string | null;
};

const DEFAULT_THEME: GymTheme = {
  primaryColor: "#059669",
  secondaryColor: null,
  logoUrl: null,
  fontFamily: "Satoshi",
  name: "FitForge",
  supportEmail: null,
  supportPhone: null,
};

type Ctx = {
  theme: GymTheme;
  setTheme: (t: Partial<GymTheme>) => void;
};

const ThemeCtx = createContext<Ctx>({ theme: DEFAULT_THEME, setTheme: () => {} });

/** Convert "#RRGGBB" to oklch components. */
function hexToOklchParts(hex: string): { L: number; C: number; H: number } | null {
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
    return { L, C, H };
  } catch {
    return null;
  }
}

const fmt = (L: number, C: number, H: number) =>
  `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(1)})`;

/** Full token set derived from a single brand hex (same hue, shifted L/C). */
function deriveTokens(hex: string, prefix: "primary" | "secondary"): Record<string, string> {
  const c = hexToOklchParts(hex);
  if (!c) return {};
  const { L, C, H } = c;
  const out: Record<string, string> = {
    [`--${prefix}`]: fmt(L, C, H),
    [`--${prefix}-foreground`]: L > 0.7 ? fmt(0.2, 0.03, H) : fmt(0.99, 0.005, H),
    [`--${prefix}-soft`]: fmt(0.96, Math.min(C, 0.05), H),
  };
  if (prefix === "primary") {
    out["--primary-deep"] = fmt(0.32, Math.min(C * 0.6, 0.09), H);
    out["--accent"] = out["--primary-soft"];
    out["--accent-foreground"] = out["--primary-deep"];
    out["--ring"] = out["--primary"];
    out["--success"] = out["--primary"];
    out["--sidebar-primary"] = out["--primary"];
    out["--sidebar-primary-foreground"] = out["--primary-foreground"];
    out["--sidebar-accent"] = out["--primary-soft"];
    out["--sidebar-accent-foreground"] = out["--primary"];
  } else {
    out["--info"] = out["--secondary"];
  }
  return out;
}

/** Neutral secondary set used when a gym hasn't picked one (never sky blue). */
const NEUTRAL_SECONDARY: Record<string, string> = {
  "--secondary": "oklch(0.45 0.01 260)",
  "--secondary-foreground": "oklch(0.99 0.002 260)",
  "--secondary-soft": "oklch(0.96 0.005 260)",
  "--info": "oklch(0.45 0.01 260)",
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<GymTheme>(DEFAULT_THEME);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const tokens: Record<string, string> = {
      ...deriveTokens(theme.primaryColor, "primary"),
      ...(theme.secondaryColor ? deriveTokens(theme.secondaryColor, "secondary") : NEUTRAL_SECONDARY),
    };
    for (const [k, v] of Object.entries(tokens)) root.style.setProperty(k, v);
    const stack = `"${theme.fontFamily}", ui-sans-serif, system-ui, sans-serif`;
    root.style.setProperty("--font-body", stack);
    root.style.setProperty("--font-heading", stack);
  }, [theme]);

  const setTheme = useCallback((t: Partial<GymTheme>) => {
    setThemeState((prev) => ({ ...prev, ...t }));
  }, []);

  const value = useMemo<Ctx>(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
