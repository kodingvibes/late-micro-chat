import { useEffect, useState } from "react";
import { X, Pencil } from "@/components/icons";

interface RenameChannelModalProps {
  open: boolean;
  channelId: number;
  channelType: "text" | "voice";
  currentName: string;
  onClose: () => void;
  onSaved: (newName: string) => void;
}

// ponytail: validation matches the backend (routers/channels.py
// update_channel_route). Only alnum, underscore, hyphen, with a
// leading "#" auto-prepended if missing. The backend is the
// source of truth; we mirror the rules here so the user gets
// instant feedback without a round-trip on the obvious cases.
function sanitize(raw: string): { ok: true; value: string } | { ok: false; reason: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "El nombre no puede estar vacío." };
  if (trimmed.length > 40) return { ok: false, reason: "Máximo 40 caracteres." };
  let name = trimmed.startsWith("#") ? trimmed : "#" + trimmed;
  const body = name.slice(1);
  if (!/^[a-zA-Z0-9_-]+$/.test(body)) {
    return { ok: false, reason: "Solo letras, números, guion y guion bajo." };
  }
  return { ok: true, value: name };
}

export default function RenameChannelModal({
  open,
  channelId,
  channelType,
  currentName,
  onClose,
  onSaved,
}: RenameChannelModalProps) {
  const [value, setValue] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(currentName);
      setError(null);
    }
  }, [open, currentName]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isVoice = channelType === "voice";

  const save = async () => {
    if (isVoice) {
      setError("Los canales de voz no se pueden renombrar.");
      return;
    }
    const r = sanitize(value);
    if (!r.ok) {
      setError(r.reason);
      return;
    }
    if (r.value === currentName) {
      // ponytail: no-op rename. The backend would 409 against the
      // UNIQUE constraint because the row's own name collides with
      // itself; we short-circuit before the request so the user
      // doesn't see a spurious "name already in use" error.
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const session = window.LateSession;
      if (!session) throw new Error("No session available");
      // ponytail: PATCH /api/chat/channels/{id} accepts {name} and
      // returns 409 on UNIQUE collision (rendered as the same error
      // string the create flow uses).
      await session.api(`/api/chat/channels/${channelId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: r.value }),
      });
      onSaved(r.value);
      onClose();
    } catch (err) {
      const msg = (err as Error).message || "";
      if (/409/.test(msg) || /already/i.test(msg)) {
        setError("Ese nombre ya está en uso.");
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-menu-backdrop"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl  bg-surface-2 shadow-2xl overflow-hidden animate-menu-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3  ">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Pencil className="w-4 h-4" />
            Renombrar canal
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:bg-surface-2"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {isVoice ? (
            <p className="text-sm text-slate-400">
              Los canales de voz no se pueden renombrar.
            </p>
          ) : (
            <>
              <p className="text-sm text-slate-400">
                Cambiá el nombre del canal. Los nombres son únicos en todo el servidor.
                Solo letras, números, guion y guion bajo.
              </p>
              <input
                type="text"
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !saving) save();
                }}
                maxLength={40}
                className="w-full px-3 py-2 rounded-lg  bg-surface-1 text-slate-200 text-sm font-mono focus:outline-none focus:"
                placeholder="#canal"
              />
              <div className="text-[10px] text-slate-500 text-right tabular-nums">
                {value.length} / 40
              </div>
            </>
          )}
          {error && <p className="text-rose-400 text-xs">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 bg-surface-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:bg-surface-2"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || isVoice}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-accent hover:bg-accent-soft text-white disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Renombrar"}
          </button>
        </div>
      </div>
    </div>
  );
}