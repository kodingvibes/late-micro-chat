import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { ChannelMember } from '../../lib/chat/domain/types'
import { useViewportClamp } from '../../hooks/use-viewport-clamp'
import { Bell, Copy } from '@/components/icons'

export interface UserContextMenuState {
  show: boolean
  x: number
  y: number
  user: ChannelMember | null
}

interface UserContextMenuProps {
  state: UserContextMenuState
  onClose: () => void
  onBuzz: (targetUserId: number) => void
  onCopyName: (name: string) => void
}

export default function UserContextMenu({
  state, onClose, onBuzz, onCopyName,
}: UserContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

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
  const { style, ready, placement } = useViewportClamp(ref, x, y, state.show, {
    estimatedSize: { width: 200, height: 120 },
  })

  if (!state.show || !state.user) return null

  const { user } = state

  const menu = (
    <div
      ref={ref}
      data-placement={placement}
      data-state={ready ? 'open' : 'measuring'}
      data-irc-context-menu
      className="irc-context-menu fixed z-[250] bg-surface-2  rounded-xl shadow-2xl py-1 min-w-[180px] overflow-hidden select-none animate-menu-pop"
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => {
          onBuzz(user.id)
          onClose()
        }}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-surface-2 transition-colors"
      >
        <Bell className="w-4 h-4 text-amber-400" />
        Zumbido
      </button>
      <button
        type="button"
        onClick={() => {
          onCopyName(user.display_name)
          onClose()
        }}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-surface-2 transition-colors"
      >
        <Copy className="w-4 h-4 text-slate-400" />
        Copiar nombre
      </button>
    </div>
  )

  // ponytail: portal to body so the menu escapes the sidebar's
  // stacking context (see ChannelContextMenu for the full story).
  if (typeof document !== 'undefined') {
    return createPortal(menu, document.body)
  }
  return menu
}

export function useUserContextMenuState() {
  const [menu, setMenu] = useState<UserContextMenuState>({
    show: false, x: 0, y: 0, user: null,
  })

  const close = useCallback(() => {
    setMenu(prev => ({ ...prev, show: false }))
  }, [])

  return { menu, setMenu, close }
}
