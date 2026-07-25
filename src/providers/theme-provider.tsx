import { createContext, useContext, useEffect, useState } from "react";
import type { AccentName, LateTheme, ThemeMode } from "@late/theme";
import { DEFAULT_THEME } from "@late/theme";

interface ThemeContextValue {
  mode: ThemeMode;
  accent: AccentName;
  mounted: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function snapshotFromWindow(): LateTheme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const t = (window as unknown as { LateTheme?: LateTheme }).LateTheme;
  return t ?? DEFAULT_THEME;
}

function applyToDocument(t: LateTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("theme-light", t.mode === "light");
  root.classList.toggle("theme-dark", t.mode === "dark");
  root.style.setProperty("--accent-primary", t.accentPrimary);
  root.style.setProperty("--accent-soft", t.accentSoft);
  root.style.setProperty("--accent-ring", t.accentRing);
  root.style.setProperty("--accent-glow-a", t.accentGlowA);
  root.style.setProperty("--accent-glow-b", t.accentGlowB);
  root.style.setProperty("--accent-glow-a-light", t.accentGlowALight);
  root.style.setProperty("--accent-glow-b-light", t.accentGlowBLight);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LateTheme>(DEFAULT_THEME);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initial = snapshotFromWindow();
    setState(initial);
    applyToDocument(initial);
    setMounted(true);
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<LateTheme>).detail ?? snapshotFromWindow();
      setState(detail);
      applyToDocument(detail);
    };
    window.addEventListener("late:theme-change", onChange as EventListener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === "late.theme") {
        const next = snapshotFromWindow();
        setState(next);
        applyToDocument(next);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("late:theme-change", onChange as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const value: ThemeContextValue = {
    mode: state.mode,
    accent: state.accent,
    mounted,
  };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  return ctx ?? { mode: "dark", accent: "indigo", mounted: false };
}
