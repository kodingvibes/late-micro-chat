import { useCallback, useRef, useState } from "react";

export interface Toast {
  id: string;
  text: string;
  type: string;
  sticky: boolean;
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const clearToasts = useCallback(() => {
    for (const timer of toastTimers.current.values()) {
      clearTimeout(timer);
    }
    toastTimers.current.clear();
    setToasts([]);
  }, []);

  const pushToast = useCallback(
    (
      text: string,
      type: string,
      opts?: { sticky?: boolean; autoCloseMs?: number }
    ) => {
      const id = crypto.randomUUID();
      const sticky = opts?.sticky ?? false;
      setToasts((prev) => [...prev.slice(-4), { id, text, type, sticky }]);
      if (sticky) return;
      const ms = opts?.autoCloseMs ?? 6500;
      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        toastTimers.current.delete(id);
      }, ms);
      toastTimers.current.set(id, timer);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    const timer = toastTimers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, pushToast, clearToasts, dismissToast };
}
