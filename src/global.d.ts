export {};

// ponytail: the chat micro uses the full RadioEngine API. The radio micro
// (late-micro-radio) is the owner of the engine; the chat only consumes
// it. Sharing the same vendor bundle means there's exactly one React
// instance, so hooks/refs work normally across the two micros.

export type StreamInfo = {
  name: string;
  url: string;
  mount: string;
  artist?: string;
  title?: string;
  category?: string;
  emoji?: string;
  accent?: string;
};

export type TrackMeta = {
  artist: string | null;
  title: string | null;
  raw: string | null;
};

export type RadioState = {
  current: StreamInfo | null;
  track: TrackMeta | null;
  playing: boolean;
  loading: boolean;
  volume: number;
  muted: boolean;
};

export interface RadioEngine {
  version: string;
  streams: readonly StreamInfo[];
  getState(): RadioState;
  subscribe(fn: (s: RadioState) => void): () => void;
  play(s: StreamInfo): void;
  toggle(): void;
  stop(): void;
  setVolume(v: number): void;
  toggleMute(): void;
  getAudioElement(): HTMLAudioElement | null;
  getAnalyser(): AnalyserNode | null;
}

export interface LateUser {
  id: number;
  email: string;
  name: string | null;
  display_name: string | null;
}

export interface LateSessionAPI {
  readonly sessionId: string | null;
  readonly user: LateUser | null;
  readonly ssoUrl: string;
  api<T>(path: string, init?: RequestInit): Promise<T>;
  updateProfile?(patch: {
    display_name?: string;
    name?: string;
    avatar_url?: string | null;
    preferences?: Record<string, unknown>;
  }): Promise<LateUser>;
  logout(): void;
  redirectToSso(): void;
  onAuthFatal(handler: () => void): () => void;
  clearSsoBudget?(): void;
}

// ponytail: the shell publishes the active theme on
// window.LateTheme whenever the user changes it. The chat
// micro mirrors those values onto its own documentElement so
// the slate / accent / light-mode overrides declared in
// index.css take effect on the chat surface too.
import type { LateTheme } from "@/lib/theme";

declare global {
  interface Window {
    RadioEngine?: RadioEngine;
    LateSession?: LateSessionAPI;
    LateTheme?: LateTheme;
    ChatEngine?: { version: string; onlineCount?: number; openNickModal?: () => void; openNotificationSettings?: () => void };
  }
}
