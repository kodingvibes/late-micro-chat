// Read everything auth-related from the shell. The shell installs
// window.LateSession before our bundle mounts, so on a real page this
// is always present. Tests inject it via setupTests.

export function getLateSession() {
  if (typeof window === "undefined") return null;
  return window.LateSession ?? null;
}

export function getSessionId(): string | null {
  return getLateSession()?.sessionId ?? null;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const s = getLateSession();
  if (!s) throw new Error("LateSession not available");
  return s.api<T>(path, init);
}

export function onAuthFatal(handler: () => void): () => void {
  const s = getLateSession();
  if (!s) return () => {};
  return s.onAuthFatal(handler);
}

export function logout() {
  getLateSession()?.logout();
}

export function redirectToSso() {
  getLateSession()?.redirectToSso();
}

export function clearSsoBudget() {
  getLateSession()?.clearSsoBudget?.();
}
