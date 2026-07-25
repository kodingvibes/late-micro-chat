import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { AccentName, LateTheme, ThemeMode } from "@/lib/theme";

interface ThemeContextValue {
  mode: ThemeMode;
  accent: AccentName;
  mounted: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const DEFAULT_THEME: LateTheme = {
  mode: "dark",
  accent: "indigo",
  accentPrimary: "#6366f1",
  accentSoft: "#818cf8",
  accentRing: "#a5b4fc",
  accentGlowA: "rgba(99,102,241,0.18)",
  accentGlowB: "rgba(99,102,241,0.12)",
  accentGlowALight: "rgba(79,70,229,0.16)",
  accentGlowBLight: "rgba(99,102,241,0.10)",
};

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
  // ponytail: pre-baked rgba tones from the shell so the
  // page-level halo tracks the accent. The shell sets these
  // in :root when it dispatches `late:theme-change`.
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
    // ponytail: the shell also installs a MutationObserver on
    // <body> for the chat micro slot. We piggyback on a
    // small `storage` listener to keep the MF in sync if the
    // user changes the theme in a different tab. localStorage
    // events fire on every window, so the MF picks up cross-
    // tab theme swaps without polling.
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
  // ponytail: the hook is intentionally permissive — outside
  // the provider the MF falls back to a sensible dark+indigo
  // default so the page still renders if the wrapper is
  // missing (e.g. in a Storybook story).
  return ctx ?? { mode: "dark", accent: "indigo", mounted: false };
}

// Re-export a no-op setter so existing call sites that
// previously expected a ThemeContext with setters don't
// blow up if anyone reaches for one. The MF only consumes
// the theme; the shell owns the mutations.
export const noop = useCallback;
