import { useState, useRef, useEffect, useCallback } from 'react'
import { Copy, LogOut, LogIn, Users, Trash2 } from 'lucide-react'

export interface ChannelContextMenuState {
  show: boolean
  x: number
  y: number
  channel: { id?: number; name: string; description?: string | null; joined?: boolean; myRole?: string | null } | null
}

interface ChannelContextMenuProps {
  state: ChannelContextMenuState
  onClose: () => void
  onCopyName: (name: string) => void
  onLeave?: (channelId: number) => void
  onJoin?: (channelId: number) => void
  onManageMembers?: (channelId: number) => void
  onDelete?: (channelId: number) => void
}

export default function ChannelContextMenu({
  state, onClose, onCopyName, onLeave, onJoin, onManageMembers, onDelete,
}: ChannelContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    if (!state.show) setConfirmingDelete(false)
  }, [state.show])

  useEffect(() => {
    if (!state.show) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [state.show, onClose])

  if (!state.show || !state.channel) return null

  const { channel, x, y } = state
  const menuW = 220
  const menuH = confirmingDelete ? 180 : 200
  const vpW = window.innerWidth
  const vpH = window.innerHeight
  const adjustedX = Math.min(x, vpW - menuW - 8)
  const adjustedY = Math.min(y, vpH - menuH - 8)

  return (
    <div
      ref={ref}
      className="fixed z-[250] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1 min-w-[180px] overflow-hidden select-none"
      style={{ left: adjustedX, top: adjustedY }}
      onClick={(e) => e.stopPropagation()}
    >
      {channel.description && (
        <div className="px-3 py-2 text-xs text-slate-400 border-b border-slate-800 max-w-[220px]">
          <span className="text-slate-500 font-semibold text-[10px] uppercase tracking-wider block mb-0.5">Descripción</span>
          <p className="break-words leading-snug">{channel.description}</p>
        </div>
      )}
      <button
        type="button"
        onClick={() => { onCopyName(channel.name); onClose() }}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
      >
        <Copy className="w-4 h-4 text-slate-400" />
        Copiar nombre
      </button>
      {channel.id !== undefined && channel.joined && channel.myRole && ['admin', 'mod'].includes(channel.myRole) && (
        <button
          type="button"
          onClick={() => { onManageMembers?.(channel.id as number); onClose() }}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <Users className="w-4 h-4 text-indigo-400" />
          Administrar miembros
        </button>
      )}
      {channel.id !== undefined && !channel.joined && (
        <button
          type="button"
          onClick={() => { onJoin?.(channel.id as number); onClose() }}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-emerald-400 hover:bg-slate-800 transition-colors"
        >
          <LogIn className="w-4 h-4 text-emerald-400" />
          Unirse
        </button>
      )}
      {channel.joined && channel.id !== undefined && (
        <button
          type="button"
          onClick={() => { onLeave?.(channel.id as number); onClose() }}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-rose-400 hover:bg-slate-800 transition-colors"
        >
          <LogOut className="w-4 h-4 text-rose-400" />
          Salir del canal
        </button>
      )}
      {channel.id !== undefined && channel.myRole === 'admin' && onDelete && (
        confirmingDelete ? (
          <div className="px-3 py-2.5 border-t border-slate-800 bg-slate-950/60">
            <div className="text-xs text-slate-300 mb-2">
              ¿Eliminar <span className="font-semibold">#{channel.name.replace(/^#/, '')}</span>? Esta acción no se puede deshacer.
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { onDelete(channel.id as number); onClose() }}
                className="flex-1 px-2 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-xs font-semibold transition-colors"
              >
                Eliminar
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="flex-1 px-2 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-rose-400 hover:bg-slate-800 transition-colors border-t border-slate-800"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            Eliminar canal
          </button>
        )
      )}
    </div>
  )
}

export function useChannelContextMenuState() {
  const [menu, setMenu] = useState<ChannelContextMenuState>({
    show: false, x: 0, y: 0, channel: null,
  })

  const close = useCallback(() => {
    setMenu(prev => ({ ...prev, show: false }))
  }, [])

  return { menu, setMenu, close }
}
