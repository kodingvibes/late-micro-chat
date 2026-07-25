// ponytail: this file lives in /lib so both the provider
// and the global ambient typing agree on the same shape.
// The real values are set by the shell on window.LateTheme
// and mirrored to the documentElement by the MF's own
// provider.

export type ThemeMode = "light" | "dark";

export type AccentName =
  | "indigo"
  | "violet"
  | "emerald"
  | "rose"
  | "amber"
  | "cyan";

export interface LateTheme {
  mode: ThemeMode;
  accent: AccentName;
  accentPrimary: string;
  accentSoft: string;
  accentRing: string;
}
