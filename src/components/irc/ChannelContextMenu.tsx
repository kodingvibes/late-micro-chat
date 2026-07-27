import { useState, useRef, useEffect, useCallback } from 'react'
import { useViewportClamp } from '../../hooks/use-viewport-clamp'
import { Copy, Users, Trash2, Pencil } from '@/components/icons'

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
  onManageMembers?: (channelId: number) => void
  onDelete?: (channelId: number) => void
  onEditTopic?: (channelId: number) => void
}

export default function ChannelContextMenu({
  state, onClose, onCopyName, onManageMembers, onDelete, onEditTopic,
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

  const { x, y } = state
  // ponytail: the menu can show a description block and a delete-
  // confirmation sub-panel; estimate the worst case so the
  // pre-position has enough room and the menu never gets
  // pushed off the viewport after the snap.
  const { style, ready, placement } = useViewportClamp(ref, x, y, state.show, {
    estimatedSize: { width: 240, height: 220 },
  })

  if (!state.show || !state.channel) return null

  const { channel } = state

  return (
    <div
      ref={ref}
      data-placement={placement}
      data-state={ready ? 'open' : 'measuring'}
      data-irc-context-menu
      className="irc-context-menu fixed z-[250] bg-surface-2  rounded-xl shadow-2xl py-1 min-w-[180px] overflow-hidden select-none animate-menu-pop"
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      {channel.description && (
        <div className="px-3 py-2 text-xs text-slate-400 max-w-[220px]">
          <span className="text-slate-500 font-semibold text-[10px] uppercase tracking-wider block mb-0.5">Descripción</span>
          <p className="break-words leading-snug">{channel.description}</p>
        </div>
      )}
      <button
        type="button"
        onClick={() => { onCopyName(channel.name); onClose() }}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-surface-2 transition-colors"
      >
        <Copy className="w-4 h-4 text-slate-400" />
        Copiar nombre
      </button>
      {channel.id !== undefined && channel.joined && channel.myRole && ['admin', 'mod'].includes(channel.myRole) && (
        <button
          type="button"
          onClick={() => { onEditTopic?.(channel.id as number); onClose() }}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-surface-2 transition-colors"
        >
          <Pencil className="w-4 h-4 text-accent" />
          Editar descripción
        </button>
      )}
      {channel.id !== undefined && channel.joined && channel.myRole && ['admin', 'mod'].includes(channel.myRole) && (
        <button
          type="button"
          onClick={() => { onManageMembers?.(channel.id as number); onClose() }}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-surface-2 transition-colors"
        >
          <Users className="w-4 h-4 text-accent" />
          Administrar miembros
        </button>
      )}
      {/* ponytail: every user is in every channel, so the Join and
          Leave entries are gone. There's nothing to opt into or out
          of. Admin Delete stays so channel owners can still prune. */}
      {channel.id !== undefined && channel.myRole === 'admin' && onDelete && (
        confirmingDelete ? (
          <div className="px-3 py-2.5 bg-surface-2">
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
                className="flex-1 px-2 py-1.5 rounded-lg  text-slate-300 hover:bg-surface-2 text-xs font-medium transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-rose-400 hover:bg-surface-2 transition-colors  "
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
