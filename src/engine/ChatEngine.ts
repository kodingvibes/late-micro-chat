import type { ChatEngine, ChatState, ChatConnectionStatus } from "@/global";

export function createChatEngine(version: string): ChatEngine {
  let status: ChatConnectionStatus = "disconnected";
  let unread = 0;
  // ponytail: useSyncExternalStore requires a stable snapshot. Returning a
  // fresh object from getState() makes React think the state changed every
  // time it re-reads, which triggers an infinite render loop. Cache the
  // snapshot and only replace it on emit.
  let snapshot: ChatState = { status, unread };
  const listeners = new Set<(s: ChatState) => void>();

  const emit = () => {
    snapshot = { status, unread };
    listeners.forEach((fn) => fn(snapshot));
  };

  return {
    version,
    getState: () => snapshot,
    subscribe(fn) {
      listeners.add(fn);
      fn(snapshot);
      return () => { listeners.delete(fn); };
    },
  };
}
