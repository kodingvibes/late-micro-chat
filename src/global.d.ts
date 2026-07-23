export {};

export type ChatConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export type ChatState = {
  status: ChatConnectionStatus;
  unread: number;
};

export interface ChatEngine {
  version: string;
  getState(): ChatState;
  subscribe(fn: (s: ChatState) => void): () => void;
}

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

declare global {
  interface Window {
    ChatEngine: ChatEngine;
    RadioEngine?: RadioEngine;
  }
}
