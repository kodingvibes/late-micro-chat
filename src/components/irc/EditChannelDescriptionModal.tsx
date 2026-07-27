import { useEffect, useState } from "react";
import { X, Pencil } from "@/components/icons";

interface EditChannelDescriptionModalProps {
  open: boolean;
  channelId: number;
  channelName: string;
  currentDescription: string | null;
  onClose: () => void;
  onSaved: (description: string | null) => void;
}

export default function EditChannelDescriptionModal({
  open,
  channelName,
  currentDescription,
  onClose,
  onSaved,
}: EditChannelDescriptionModalProps) {
  const [value, setValue] = useState(currentDescription ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(currentDescription ?? "");
      setError(null);
    }
  }, [open, currentDescription]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const save = async () => {
    if (!channelName) return;
    setSaving(true);
    setError(null);
    try {
      // ponytail: the PATCH endpoint accepts description as null
      // (to clear) or a string. We send an explicit null when the
      // user blanked the field so the backend persists the change
      // instead of leaving the old value.
      const trimmed = value.trim();
      const session = window.LateSession;
      if (!session) throw new Error("No session available");
      await session.api(`/api/chat/channels/${channelName}`, {
        method: "PATCH",
        body: JSON.stringify({ description: trimmed === "" ? null : trimmed }),
      });
      onSaved(trimmed === "" ? null : trimmed);
      onClose();
    } catch (err) {
      setError((err as Error).message);
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
            Editar descripción del canal
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
          <p className="text-sm text-slate-400">
            Cambiá el topic que ven los miembros en la cabecera del canal. Dejalo vacío para
            quitarlo.
          </p>
          <textarea
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={3}
            maxLength={280}
            className="w-full px-3 py-2 rounded-lg  bg-surface-1 text-slate-200 text-sm focus:outline-none focus:"
            placeholder="Descripción o topic del canal…"
          />
          <div className="text-[10px] text-slate-500 text-right tabular-nums">
            {value.length} / 280
          </div>
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
            disabled={saving}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-accent hover:bg-accent-soft text-white disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
