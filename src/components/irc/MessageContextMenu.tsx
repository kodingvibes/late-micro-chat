import { useState, useRef, useEffect, useCallback } from 'react'
import type { ChatMessage } from '../../lib/chat/domain/types'
import { getEmoji } from '../../lib/emoji'
import { hasImageMarker, getAttachmentMarker } from '../../lib/chat/domain/parsers'
import { useViewportClamp } from '../../hooks/use-viewport-clamp'
import { SmilePlus, Bell, Copy, MessageSquareReply, CornerUpRight, EyeOff, Trash2, Hash, Download, ImageDown, FileDown, LinkIcon, Pencil } from '@/components/icons'

function EmojiIcon({ name, size = 20 }: { name: string; size?: number }) {
  const def = getEmoji(name)
  if (!def) return null
  const html = def.svg.replace(/^<svg /, `<svg width="${size}" height="${size}" `)
  return (
    <span className="inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export interface ContextMenuState {
  show: boolean
  x: number
  y: number
  message: ChatMessage | null
  isOwn: boolean
  isTargetOnline: boolean
}

interface MessageContextMenuProps {
  state: ContextMenuState
  onClose: () => void
  onReact: (messageId: number, emoji: string) => void
  onReply: (message: ChatMessage) => void
  onBuzz: (targetUserId: number) => void
  onCopyText: (text: string) => void
  onForward: (message: ChatMessage) => void
  myRole?: string | null
  onHide?: (messageId: number) => void
  onDelete?: (messageId: number) => void
  onCopyImage?: (message: ChatMessage) => void
  onDownloadImage?: (message: ChatMessage) => void
  onDownloadAttachment?: (message: ChatMessage) => void
  onCopyLink?: (message: ChatMessage) => void
  onEdit?: (message: ChatMessage) => void
  /** Server-provided edit window, in seconds. Comes from the ws `hello` frame. */
  editWindowSeconds?: number
}

/**
 * Mirrors the server's checks in PATCH /api/chat/messages/{id}. Showing the
 * action when the server would reject it is the failure mode worth avoiding,
 * so every condition here is the strict one.
 */
function canEditMessage(message: ChatMessage, isOwn: boolean, windowSeconds: number): boolean {
  if (!isOwn) return false
  // Optimistic bubbles have a negative placeholder id until the POST returns.
  if (message.id <= 0) return false
  if (message.hidden) return false
  if (getAttachmentMarker(message.content)) return false
  return Math.floor(Date.now() / 1000) - message.created_at <= windowSeconds
}

const quickEmojis = ['heart', 'thumbsup', 'thumbsdown', 'laugh', 'smile', 'point', 'cry', 'serious', 'angry', 'fire', 'star', 'sparkles', 'rocket', 'check']

export default function MessageContextMenu({
  state, onClose, onReact, onReply, onBuzz, onCopyText, onForward, myRole, onHide, onDelete, onCopyImage, onDownloadImage, onDownloadAttachment, onCopyLink, onEdit, editWindowSeconds = 900,
}: MessageContextMenuProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const isAdmin = myRole === 'admin' || myRole === 'mod'
  const ref = useRef<HTMLDivElement>(null)
  const emojiRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!state.show) return
    setShowEmojiPicker(false)
    // Use 'click' (not 'mousedown') so button onClick handlers
    // inside the menu fire BEFORE the outside-click check runs.
    // With 'mousedown' the document listener could close the menu
    // before the button's click handler executes, making
    // Responder/Reenviar/Copiar appear to do nothing.
    const onClickOutside = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('touchstart', onClickOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('touchstart', onClickOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [state.show, onClose])

  const { x, y } = state
  // ponytail: estimate the worst-case size (emoji picker adds
  // ~140px of height when expanded). The clamp hook uses this
  // to pre-position offscreen; without it, opening the picker
  // could push the menu off the bottom of the viewport on
  // short windows because the position was calculated for the
  // collapsed size.
  const { style, ready, placement } = useViewportClamp(ref, x, y, state.show, {
    estimatedSize: { width: 220, height: 360 },
  })

  if (!state.show || !state.message) return null

  const { message, isOwn, isTargetOnline } = state
  const canEdit = !!onEdit && canEditMessage(message, isOwn, editWindowSeconds)

  return (
    <div
      ref={ref}
      data-placement={placement}
      data-state={ready ? 'open' : 'measuring'}
      data-irc-context-menu
      className="irc-context-menu fixed z-[250] bg-surface-2 border border-accent/20 rounded-xl shadow-2xl py-1 min-w-[180px] overflow-hidden select-none animate-menu-pop"
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => {
          setShowEmojiPicker(v => !v)
        }}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-surface-2 transition-colors"
      >
        <SmilePlus className="w-4 h-4 text-accent" />
        Reaccionar
        <span className="ml-auto text-[10px] text-slate-500">{showEmojiPicker ? '▲' : '▼'}</span>
      </button>
      {showEmojiPicker && (
        <div ref={emojiRef} className="grid grid-cols-5 gap-1.5 px-3 py-2 bg-surface-1 border-t border-accent/15">
          {quickEmojis.map(name => (
            <button
              key={name}
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => {
                onReact(message.id, name)
                onClose()
              }}
              className="aspect-square min-w-[44px] rounded-lg hover:bg-surface-2 flex items-center justify-center transition-colors active:scale-95"
              title={name}
            >
              <EmojiIcon name={name} size={22} />
            </button>
          ))}
        </div>
      )}
      {canEdit && (
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => {
            onEdit?.(message)
            onClose()
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-surface-2 transition-colors"
        >
          <Pencil className="w-4 h-4 text-amber-400" />
          Editar
        </button>
      )}
      <button
        type="button"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => {
          onReply(message)
          onClose()
        }}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-surface-2 transition-colors"
      >
        <MessageSquareReply className="w-4 h-4 text-cyan-400" />
        Responder
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => {
          onForward(message)
          onClose()
        }}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-surface-2 transition-colors"
      >
        <CornerUpRight className="w-4 h-4 text-cyan-400" />
        Reenviar
      </button>
      {!isOwn && isTargetOnline && (
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => {
            onBuzz(message.user_id)
            onClose()
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-surface-2 transition-colors"
        >
          <Bell className="w-4 h-4 text-amber-400" />
          Zumbido
        </button>
      )}
      {isAdmin && (
        <>
          <div className="h-px bg-surface-2 my-1" />
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => {
              navigator.clipboard.writeText(String(message.id)).catch(() => {})
              onClose()
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-surface-2 transition-colors"
          >
            <Hash className="w-4 h-4 text-slate-400" />
            Copiar ID
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => {
              onHide?.(message.id)
              onClose()
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-surface-2 transition-colors"
          >
            <EyeOff className="w-4 h-4 text-amber-400" />
            Ocultar
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => {
              onDelete?.(message.id)
              onClose()
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:bg-surface-2 transition-colors"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
            Eliminar
          </button>
        </>
      )}
      <button
        type="button"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => {
          onCopyText(message.content)
          onClose()
        }}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-surface-2 transition-colors"
      >
        <Copy className="w-4 h-4 text-slate-400" />
        Copiar texto
      </button>
      {hasImageMarker(message.content) && onCopyImage && (
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => {
            onCopyImage(message)
            onClose()
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-surface-2 transition-colors"
        >
          <ImageDown className="w-4 h-4 text-slate-400" />
          Copiar imagen
        </button>
      )}
      {hasImageMarker(message.content) && onDownloadImage && (
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => {
            onDownloadImage(message)
            onClose()
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-surface-2 transition-colors"
        >
          <Download className="w-4 h-4 text-slate-400" />
          Descargar imagen
        </button>
      )}
      {getAttachmentMarker(message.content) && onDownloadAttachment && (
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => {
            onDownloadAttachment(message)
            onClose()
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-surface-2 transition-colors"
        >
          <FileDown className="w-4 h-4 text-slate-400" />
          Descargar archivo
        </button>
      )}
      {getAttachmentMarker(message.content) && onCopyLink && (
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => {
            onCopyLink(message)
            onClose()
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-surface-2 transition-colors"
        >
          <LinkIcon className="w-4 h-4 text-slate-400" />
          Copiar enlace
        </button>
      )}
    </div>
  )
}

export function useContextMenuState() {
  const [menu, setMenu] = useState<ContextMenuState>({
    show: false, x: 0, y: 0, message: null, isOwn: false, isTargetOnline: false,
  })

  const close = useCallback(() => {
    setMenu(prev => ({ ...prev, show: false }))
  }, [])

  return { menu, setMenu, close }
}
