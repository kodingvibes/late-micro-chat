import { useRef, useEffect, useLayoutEffect, useState, useCallback, useMemo, useDeferredValue } from 'react'
import { CornerUpRight } from '@/components/icons'
import type { ChatMessage } from '../../lib/chat/domain/types'
import { getNickColor } from '../../lib/irc/colors'
import { getAttachmentMarker, hasImageMarker, extractImageUrl, extractImageCaption, extractImageUrls, extractImagesCaption } from '../../lib/chat/domain/parsers'
import { inlineMarkdown } from '../../lib/chat/domain/markdown'
import ImagePreview, { ImageGallery, ImageLightbox } from './ImagePreview'
import LinkPreviewList from './LinkPreviewList'
import RichText from './RichText'
import MessageContextMenu, { useContextMenuState } from './MessageContextMenu'
import AttachmentCard from './AttachmentCard'
import AudioWaveform from './AudioWaveform'
import MessageReactions from './MessageReactions'
import VoiceNotePlayer from './VoiceNotePlayer'
import LazyMount from './LazyMount'
import DayHeader from './DayHeader'
import NewMessagesBadge from './NewMessagesBadge'
import { useScrollState } from './useScrollState'
import { estimateMessageHeight, setMeasuredHeight, getCachedHeight, clearHeights } from './MessageHeightCache'
import { useLongPress } from '../../hooks/useLongPress'
import './irc.css'

const HEADER_INTERVAL_S = 300
const BUBBLE_MAX_W = 600
const VIRTUAL_WINDOW = 80

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

interface MessageListProps {
  messages: ChatMessage[]
  currentNick: string
  channelName: string
  channelMembers?: { id: number; display_name: string; active?: boolean }[]
  /** Map of user_id -> current display_name. */
  nickByUserId?: Map<number, string>
  /** The local user's id. */
  myUserId?: number | null
  /** The current user's role in this channel. */
  myRole?: string | null
  /** Toggle a reaction on a message. */
  onToggleReaction?: (messageId: number, emoji: string) => void
  /** Called when the user scrolls near the top of the list. */
  onLoadMore?: () => Promise<void> | void
  loadingMore?: boolean
  hasMore?: boolean
  /** Reply to a user by quoting their message. */
  onReply?: (message: ChatMessage) => void
  /** Send a buzz (attention signal) to a user. */
  onBuzz?: (targetUserId: number) => void
  /** Copy message text to clipboard. */
  onCopyText?: (text: string) => void
  /** Forward a message to another channel. */
  onForward?: (message: ChatMessage) => void
  /** Hide a message (censor). Admin/mod only. */
  onHide?: (messageId: number) => void
  /** Delete a message. Admin/mod only. */
  onDelete?: (messageId: number) => void
  /** Copy an image message to the clipboard. */
  onCopyImage?: (message: ChatMessage) => void
  /** Download an image message. */
  onDownloadImage?: (message: ChatMessage) => void
  /** Download a non-image attachment (audio/video/document). */
  onDownloadAttachment?: (message: ChatMessage) => void
  /** Copy the link to an attachment to the clipboard. */
  onCopyLink?: (message: ChatMessage) => void
  /** Start editing one of your own messages. */
  onEdit?: (message: ChatMessage) => void
  /** Server-provided edit window, in seconds, from the ws `hello` frame. */
  editWindowSeconds?: number
  /** Called when a user clicks the float button on a video. */
  onVideoFloat?: (attachmentId: string) => void
  /** Called when a video starts playing. */
  onVideoPlay?: (attachmentId: string) => void
  /** Called when a video element mounts. Used for floating video. */
  onVideoRef?: (attachmentId: string, el: HTMLVideoElement | null) => void
  /** The currently-floating video attachment ID, if any. */
  floatingVideo?: string | null
}

function ReceiptIndicator({ delivered, read, total }: { delivered: number; read: number; total: number }) {
  if (total === 0) {
    return (
      <span className="inline-flex items-center text-slate-400 ml-1" aria-label="Enviado" title="Enviado">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12l5 5 9-9" />
        </svg>
      </span>
    )
  }
  if (read >= total) {
    return (
      <span className="inline-flex items-center text-accent ml-1" aria-label="Leído por todos" title="Leído por todos">
        <svg width="16" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12l4 4 6-6" />
          <path d="M12 14l4 4 6-6" />
        </svg>
      </span>
    )
  }
  if (delivered > 0) {
    return (
      <span className="inline-flex items-center text-slate-400 ml-1" aria-label="Entregado" title="Entregado">
        <svg width="16" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12l4 4 6-6" />
          <path d="M12 14l4 4 6-6" />
        </svg>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center text-slate-500 ml-1" aria-label="Enviado" title="Enviado">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12l5 5 9-9" />
      </svg>
    </span>
  )
}

interface DisplayItem {
  type: 'day' | 'bubble'
  message: ChatMessage
  isOwn: boolean
  // ponytail: precomputed metadata used by the virtualizer.
  // `id` is unique per item (divider ids are prefixed so day
  // dividers and bubbles never collide). `h` is the best known
  // height for the item — measured if we have it, estimated
  // otherwise. The virtualizer uses `h` to size the placeholder
  // that replaces the off-window items, so the scrollbar never
  // jumps when items enter/leave the window.
  id: string
  h: number
}

function buildDisplayList(
  messages: ChatMessage[],
  currentNick: string,
  nickByUserId: Map<number, string>,
  bubbleWidth: number,
): DisplayItem[] {
  const items: DisplayItem[] = []
  let lastDay = ''

  const nickFor = (m: ChatMessage) => nickByUserId.get(m.user_id) ?? m.display_name
  const isOwn = (m: ChatMessage) => nickFor(m) === currentNick

  // ponytail: first pass — emit dividers so the second pass can
  // resolve a "previous bubble" for showHeader detection without
  // skipping day dividers (the old code compared across day
  // boundaries and forced a header on every first message of a
  // day, which is correct, but we still need the right
  // "prev" reference inside a day).
  const staged: Array<{ kind: 'day' | 'bubble'; day: string; msg: ChatMessage }> = []
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const d = new Date(msg.created_at * 1000)
    const day = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    if (day !== lastDay) {
      staged.push({ kind: 'day', day, msg })
      lastDay = day
    }
    staged.push({ kind: 'bubble', day, msg })
  }

  for (let i = 0; i < staged.length; i++) {
    const s = staged[i]
    if (s.kind === 'day') {
      items.push({
        type: 'day',
        message: s.msg,
        isOwn: false,
        id: `d-${s.day}`,
        h: 36,
      })
      continue
    }
    const msg = s.msg
    // ponytail: walk back to the previous bubble item, ignoring
    // day dividers. Two messages in the same day with the same
    // author within HEADER_INTERVAL_S (and same type) get a
    // headerless continuation. Matches the runtime logic in
    // MessageList below.
    let prevBubble: ChatMessage | null = null
    for (let j = i - 1; j >= 0; j--) {
      if (staged[j].kind === 'bubble') { prevBubble = staged[j].msg; break }
    }
    const showHeader = !prevBubble
      || prevBubble.user_id !== msg.user_id
      || !!prevBubble.is_action !== !!msg.is_action
      || hasImageMarker(prevBubble.content) !== hasImageMarker(msg.content)
      || msg.created_at - prevBubble.created_at > HEADER_INTERVAL_S
    items.push({
      type: 'bubble',
      message: msg,
      isOwn: isOwn(msg),
      id: `m-${msg.id}`,
      h: getCachedHeight(msg.id) ?? estimateMessageHeight(msg, bubbleWidth, showHeader),
    })
  }

  return items
}

function ReplyBlock({ message }: { message: ChatMessage }) {
  const m = message
  if (!m.reply_to || !m.reply_to_author) return null
  const raw = m.reply_to_content || ''
  const isImageReply = hasImageMarker(raw)
  const att = !isImageReply ? getAttachmentMarker(raw) : null
  const caption = isImageReply ? (extractImagesCaption(raw) || extractImageCaption(raw)) : null
  return (
    <div className="flex items-start gap-2 pl-2 py-0.5 mb-1 border-l-2 border-accent/40">
      <div className="flex-1 min-w-0">
        <span className="text-[11px] font-semibold text-accent/80">{m.reply_to_author}</span>
        {caption && <p className="text-[12px] text-slate-400 truncate">{caption}</p>}
        {isImageReply ? (() => {
          const urls = extractImageUrls(raw)
          const toUrl = (u: string) => u.startsWith('data:') ? u : `/api/chat/attachments/${u}`
          if (urls.length > 1) {
            const thumbs = urls.slice(0, 3).map(toUrl)
            return (
              <div className="flex gap-1 mt-0.5">
                {thumbs.map((u, i) => (<img key={i} src={u} alt="" className="h-10 w-10 rounded object-cover" loading="lazy" />))}
                {urls.length > 3 && <div className="h-10 w-10 rounded bg-surface-2 flex items-center justify-center text-[10px] text-slate-400 font-medium">+{urls.length - 3}</div>}
              </div>
            )
          }
          const single = urls.length === 1 ? toUrl(urls[0]) : (() => { const e = extractImageUrl(raw); return e ? toUrl(e) : null })()
          return single ? <img src={single} alt="" className="h-10 w-10 rounded object-cover mt-0.5" loading="lazy" /> : null
        })() : att?.kind === 'voicenote' ? (
          <div className="mt-0.5"><LazyMount minHeight={120}><VoiceNotePlayer noteId={att.id} /></LazyMount></div>
        ) : att?.kind === 'audio' ? (
          <div className="mt-0.5"><LazyMount minHeight={120}><AudioWaveform src={`/api/chat/attachments/${att.id}`} /></LazyMount></div>
        ) : att ? (
          <p className="text-[12px] text-slate-400 truncate">📎 {att.kind}</p>
        ) : raw && <p className="text-[13px] text-slate-400 truncate">{raw}</p>}
      </div>
    </div>
  )
}

function ForwardedBlock({ message }: { message: ChatMessage }) {
  const m = message
  if (!m.forwarded_from) return null
  return (
    <div className="flex items-center gap-1.5 mb-1 text-[11px] text-slate-500 select-none">
      <CornerUpRight className="w-3 h-3 text-slate-500 shrink-0" />
      <span>Reenviado de <span className="text-slate-400 font-medium">{m.forwarded_from.channel_name}</span></span>
      <span className="text-slate-600">·</span>
      <span className="text-slate-400">@{m.forwarded_from.display_name}</span>
    </div>
  )
}

function ContentBlock({ message, members, isOwn, onVideoFloat, onVideoPlay, onVideoRef, floatingVideo }: {
  message: ChatMessage; members?: { id: number; display_name: string }[]; isOwn: boolean
  onVideoFloat?: (id: string) => void; onVideoPlay?: (id: string) => void
  onVideoRef?: (id: string, el: HTMLVideoElement | null) => void; floatingVideo?: string | null
}) {
  const m = message
  if (m.hidden) {
    return <span className="text-slate-500 italic line-through text-sm">{m.content === '[eliminado]' ? '[eliminado]' : '[mensaje oculto]'}</span>
  }
  const att = getAttachmentMarker(m.content)
  if (att) {
    const caption = extractImageCaption(m.content)
    if (att.kind === 'voicenote') return <LazyMount minHeight={120}><VoiceNotePlayer noteId={att.id} /></LazyMount>
    if (att.kind === 'audio') return <LazyMount minHeight={120}><AudioWaveform src={`/api/chat/attachments/${att.id}`} /></LazyMount>
    return <>{caption && <RichText text={caption} members={members} isOwn={isOwn} />}<AttachmentCard attachmentId={att.id} onFloat={onVideoFloat} onVideoPlay={onVideoPlay} onVideoRef={onVideoRef} floatingVideo={floatingVideo} /></>
  }
  if (hasImageMarker(m.content)) return null
  return <RichText text={m.content} members={members} isOwn={isOwn} />
}

function ActionRow({ m, nick, isOwn, handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel, onContextMenu }: {
  m: ChatMessage; nick: string; isOwn: boolean
  handleTouchStart: (e: React.TouchEvent) => void
  handleTouchMove: (e: React.TouchEvent) => void
  handleTouchEnd: (e: React.TouchEvent) => void
  handleTouchCancel: (e: React.TouchEvent) => void
  onContextMenu?: (msg: ChatMessage, x: number, y: number) => void
}) {
  // ponytail: right-click / long-press handlers live on the action
  // text itself, not on the row's outer div. The row has wide
  // padding around the text and that empty area is where the user
  // sometimes hits the menu by accident — e.g. just below a long
  // line of messages. Gating the menu to the actual text bubble
  // means a stray tap on whitespace does nothing.
  return (
    <div
      id={`msg-${m.id}`}
      className="group/msg flex gap-2 px-4 py-0.5 items-start select-none"
      style={{ contain: 'layout style' }}
    >
      <div
        className="flex-1 min-w-0 max-w-full"
        onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(m, e.clientX, e.clientY) }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        <ForwardedBlock message={m} />
        <div className="text-[15px] sm:text-sm italic text-slate-400">
          <span className="not-italic font-semibold" style={{ color: getNickColor(nick) }}>
            * {nick}
          </span>{' '}
          <span key={m.id}>
            {m.hidden ? (
              <span className="text-slate-500 not-italic line-through text-sm">
                {m.content === '[eliminado]' ? '[eliminado]' : '[mensaje oculto]'}
              </span>
            ) : (
              inlineMarkdown(m.content)
            )}{' '}
          </span>
          {'*'}
          {isOwn && (
            <ReceiptIndicator
              delivered={m.delivered_count ?? 0}
              read={m.read_count ?? 0}
              total={m.member_count ?? 0}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function ImageRow({ m, nick, isOwn, showHeader, handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel, onContextMenu, onImageOpen, onLinkOpen, nickByUserId, myUserId, onToggleReaction }: {
  m: ChatMessage; nick: string; isOwn: boolean; showHeader: boolean
  handleTouchStart: (e: React.TouchEvent) => void
  handleTouchMove: (e: React.TouchEvent) => void
  handleTouchEnd: (e: React.TouchEvent) => void
  handleTouchCancel: (e: React.TouchEvent) => void
  onContextMenu?: (msg: ChatMessage, x: number, y: number) => void
  onImageOpen?: (images: string[], index: number) => void
  onLinkOpen?: (url: string) => void
  nickByUserId?: Map<number, string>
  myUserId?: number | null
  onToggleReaction?: (messageId: number, emoji: string) => void
}) {
  const multi = extractImageUrls(m.content)
  let allImages: string[] = []
  let galleryCaption: string | null = null
  if (multi.length > 0) {
    allImages = multi.map((raw: string) => raw.startsWith('data:') ? raw : `/api/chat/attachments/${raw}`)
    galleryCaption = extractImagesCaption(m.content)
  } else {
    const raw = extractImageUrl(m.content)
    if (raw) {
      allImages = [raw.startsWith('data:') ? raw : `/api/chat/attachments/${raw}`]
      galleryCaption = extractImageCaption(m.content)
    }
  }
  if (allImages.length === 0) return null

  return (
    <div
      id={`msg-${m.id}`}
      className={`group/msg flex items-start gap-1.5 px-4 py-0.5 select-none ${isOwn ? 'justify-end' : ''}`}
      style={{ contain: 'layout style' }}
    >
      <div
        className={`flex flex-col max-w-[75%] sm:max-w-[65%] ${isOwn ? 'items-end' : 'items-start'}`}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(m, e.clientX, e.clientY) }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        {showHeader && (
          <div className="text-[11px] font-semibold mb-0.5" style={{ color: getNickColor(nick) }}>
            {nick}
          </div>
        )}
        <div className="space-y-1.5">
          <ForwardedBlock message={m} />
          <ReplyBlock message={m} />
          {galleryCaption && (
            <div className="text-sm leading-snug text-slate-100 break-words">
              {galleryCaption}
            </div>
          )}
          {allImages.length === 1 ? (
            <ImagePreview
              dataUrl={allImages[0]}
              onOpen={() => onImageOpen!(allImages, 0)}
              width={m.attachment?.width}
              height={m.attachment?.height}
            />
          ) : (
            <ImageGallery images={allImages} onOpen={(idx) => onImageOpen!(allImages, idx)} />
          )}
          {m.reactions && m.reactions.length > 0 && nickByUserId && (
            <MessageReactions
              reactions={m.reactions}
              myUserId={myUserId ?? null}
              nickByUserId={nickByUserId}
              onToggle={(emoji) => onToggleReaction?.(m.id, emoji)}
            />
          )}
        {onLinkOpen && (
          <LazyMount minHeight={168}><LinkPreviewList content={m.content} ogData={m.og_data} onOpen={onLinkOpen} /></LazyMount>
        )}
      </div>
      <span className="text-[10px] text-slate-500 tabular-nums mt-0.5 px-1 opacity-100 sm:opacity-0 sm:group-hover/msg:opacity-100 inline-flex items-center gap-1">
          <span>{formatTime(m.created_at * 1000)}</span>
          {m.edited_at ? <span title="Editado">(editado)</span> : null}
          {isOwn && (
            <ReceiptIndicator
              delivered={m.delivered_count ?? 0}
              read={m.read_count ?? 0}
              total={m.member_count ?? 0}
            />
          )}
        </span>
      </div>
    </div>
  )
}

function BubbleMessage({ m, nick, isOwn, showHeader, isNew, members, nickByUserId, myUserId, onLinkOpen, onToggleReaction, onVideoFloat, onVideoPlay, onVideoRef, floatingVideo, handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel, onContextMenu }: {
  m: ChatMessage; nick: string; isOwn: boolean; showHeader: boolean; isNew: boolean
  members?: { id: number; display_name: string }[]
  nickByUserId?: Map<number, string>; myUserId?: number | null
  onLinkOpen?: (url: string) => void
  onToggleReaction?: (messageId: number, emoji: string) => void
  onVideoFloat?: (attachmentId: string) => void; onVideoPlay?: (attachmentId: string) => void
  onVideoRef?: (attachmentId: string, el: HTMLVideoElement | null) => void; floatingVideo?: string | null
  handleTouchStart: (e: React.TouchEvent) => void
  handleTouchMove: (e: React.TouchEvent) => void
  handleTouchEnd: (e: React.TouchEvent) => void
  handleTouchCancel: (e: React.TouchEvent) => void
  onContextMenu?: (msg: ChatMessage, x: number, y: number) => void
}) {
  const bubbleClass = isOwn
    ? 'rounded-2xl bg-accent text-slate-50 shadow-bubble-own w-full transition-shadow hover:shadow-lg'
    : 'rounded-2xl bg-slate-800/70 text-slate-100 shadow-bubble w-full transition-shadow hover:shadow-lg'
  const headerClass = isOwn
    ? 'px-3 pt-1 pb-0.5 text-[11px] font-semibold opacity-80 border-b border-white/10'
    : 'px-3 pt-1 pb-0.5 text-[11px] font-semibold border-b border-accent/15'
  const headerStyle = isOwn ? undefined : { color: getNickColor(nick) }
  const widthClass =
    'max-w-[75%] sm:max-w-[65%] min-w-0 has-[[data-og-card]]:w-[75%] sm:has-[[data-og-card]]:w-[65%] has-[[data-og-card]]:max-w-[26rem]'
  const containerClass = isOwn
    ? `flex flex-col items-end ${widthClass}`
    : `flex flex-col items-start ${widthClass}`
  const outerClass = isOwn
    ? `group/msg flex items-start gap-1.5 px-4 py-0.5 justify-end select-none${isNew ? ' irc-msg-enter' : ''}`
    : `group/msg flex items-start gap-1.5 px-4 py-0.5 select-none${isNew ? ' irc-msg-enter' : ''}`
  const linkContainerClass = 'mb-1.5 flex w-full min-w-0 flex-col items-stretch gap-1.5'

  return (
    <div
      id={`msg-${m.id}`}
      className={outerClass}
      style={{ contain: 'layout style' }}
    >
      {/* ponytail: context-menu / long-press handlers live on the
          content column, not on the outer row. The row has wide
          padding (px-4) and the timestamp span at the bottom
          leaves a fair amount of whitespace on the right (own
          messages) or left (other messages). A right-click or
          long-press on that empty area would otherwise fire the
          menu even though the user wasn't aiming at the bubble,
          which is the confusion the user reported. Gating the
          menu to the content column means a stray tap on
          whitespace does nothing. */}
      <div
        className={containerClass}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(m, e.clientX, e.clientY) }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        {onLinkOpen && (
          <div className={linkContainerClass}>
            <LazyMount minHeight={168}><LinkPreviewList content={m.content} ogData={m.og_data} onOpen={onLinkOpen} /></LazyMount>
          </div>
        )}
        <div className={bubbleClass}>
          {showHeader && (
            <div className={headerClass} style={headerStyle}>
              {nick}
            </div>
          )}
          <div className="px-3 py-1 text-[15px] sm:text-sm leading-relaxed">
            <div key={m.id}>
              <ForwardedBlock message={m} />
              <ReplyBlock message={m} />
              <ContentBlock message={m} members={members} isOwn={isOwn} onVideoFloat={onVideoFloat} onVideoPlay={onVideoPlay} onVideoRef={onVideoRef} floatingVideo={floatingVideo} />
              {m.reactions && m.reactions.length > 0 && nickByUserId && (
                <MessageReactions
                  reactions={m.reactions}
                  myUserId={myUserId ?? null}
                  nickByUserId={nickByUserId}
                  onToggle={(emoji) => onToggleReaction?.(m.id, emoji)}
                />
              )}
            </div>
          </div>
        </div>
        <span className="text-[10px] text-slate-500 tabular-nums mt-0.5 px-1 opacity-100 sm:opacity-0 sm:group-hover/msg:opacity-100 inline-flex items-center gap-1">
          <span>{formatTime(m.created_at * 1000)}</span>
          {m.edited_at ? <span title="Editado">(editado)</span> : null}
          {isOwn && (
            <ReceiptIndicator
              delivered={m.delivered_count ?? 0}
              read={m.read_count ?? 0}
              total={m.member_count ?? 0}
            />
          )}
        </span>
      </div>
    </div>
  )
}

function MessageRow({
  message, isOwn, showHeader, isNew, members, nickByUserId, myUserId, onImageOpen, onLinkOpen,
  onContextMenu, onToggleReaction, onVideoFloat, onVideoPlay, onVideoRef, floatingVideo,
  onMeasured,
}: {
  message: ChatMessage
  isOwn: boolean
  showHeader: boolean
  isNew: boolean
  members?: { id: number; display_name: string }[]
  nickByUserId?: Map<number, string>
  myUserId?: number | null
  onImageOpen?: (images: string[], index: number) => void
  onLinkOpen?: (url: string) => void
  onContextMenu?: (msg: ChatMessage, x: number, y: number) => void
  onToggleReaction?: (messageId: number, emoji: string) => void
  onVideoFloat?: (attachmentId: string) => void
  onVideoPlay?: (attachmentId: string) => void
  onVideoRef?: (attachmentId: string, el: HTMLVideoElement | null) => void
  floatingVideo?: string | null
  onMeasured?: (id: number, h: number) => void
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = rowRef.current
    if (!el || !onMeasured) return
    const update = () => {
      const h = el.getBoundingClientRect().height
      if (h > 0) onMeasured(message.id, h)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [message.id, onMeasured])
  const m = message
  const nick = nickByUserId?.get(m.user_id) ?? m.display_name

  // ponytail: long-press via the shared hook. The hook keeps
  // its own timer so the row only fires one long-press per
  // gesture, and cancels on movement past 10px so scrolling
  // the chat never opens the menu. The 400ms hold matches
  // iOS Safari's native threshold.
  const {
    onTouchStart: lpTouchStart,
    onTouchMove: lpTouchMove,
    onTouchEnd: lpTouchEnd,
    onTouchCancel: lpTouchCancel,
  } = useLongPress({
    onLongPress: (e) => {
      const t = e.touches[0]
      if (t) onContextMenu?.(m, t.clientX, t.clientY)
    },
  })

  const isAction = !!m.is_action
  const isImage = hasImageMarker(m.content)

  if (isAction) {
    return <ActionRow m={m} nick={nick} isOwn={isOwn} handleTouchStart={lpTouchStart} handleTouchMove={lpTouchMove} handleTouchEnd={lpTouchEnd} handleTouchCancel={lpTouchCancel} onContextMenu={onContextMenu} />
  }

  if (isImage && onImageOpen) {
    return <ImageRow m={m} nick={nick} isOwn={isOwn} showHeader={showHeader} handleTouchStart={lpTouchStart} handleTouchMove={lpTouchMove} handleTouchEnd={lpTouchEnd} handleTouchCancel={lpTouchCancel} onContextMenu={onContextMenu} onImageOpen={onImageOpen} onLinkOpen={onLinkOpen} nickByUserId={nickByUserId} myUserId={myUserId} onToggleReaction={onToggleReaction} />
  }

  return (
    <div ref={rowRef}>
      <BubbleMessage
        m={m}
        nick={nick}
        isOwn={isOwn}
        showHeader={showHeader}
        isNew={isNew}
        members={members}
        nickByUserId={nickByUserId}
        myUserId={myUserId}
        onLinkOpen={onLinkOpen}
        onToggleReaction={onToggleReaction}
        onVideoFloat={onVideoFloat}
        onVideoPlay={onVideoPlay}
        onVideoRef={onVideoRef}
        floatingVideo={floatingVideo}
        handleTouchStart={lpTouchStart}
        handleTouchMove={lpTouchMove}
        handleTouchEnd={lpTouchEnd}
        handleTouchCancel={lpTouchCancel}
        onContextMenu={onContextMenu}
      />
    </div>
  )
}

export default function MessageList({
  messages, currentNick, channelName, channelMembers, nickByUserId, myUserId, myRole, onToggleReaction,
  onLoadMore, loadingMore, hasMore, onReply, onBuzz, onCopyText, onForward, onHide, onDelete, onCopyImage, onDownloadImage, onDownloadAttachment, onCopyLink, onEdit, editWindowSeconds,
  onVideoFloat, onVideoPlay, onVideoRef, floatingVideo,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null)
  const prevChannelRef = useRef(channelName)
  // Track which message IDs have already appeared so new
  // ones get the slide-up-fade-in animation on mount.
  const seenIdsRef = useRef<Set<number>>(new Set())
  const { menu: contextMenu, setMenu: setContextMenu, close: closeContextMenu } = useContextMenuState()
  const [bubbleWidth, setBubbleWidth] = useState(BUBBLE_MAX_W)

  // ponytail: reset the height cache when the channel changes so
  // a new channel's messages don't inherit the previous channel's
  // pixel-perfect heights (the bubble width is different, the
  // fonts are the same but the day dividers and last-read marker
  // may have shifted).
  useEffect(() => {
    if (prevChannelRef.current !== channelName) {
      clearHeights()
      seenIdsRef.current = new Set()
      prevChannelRef.current = channelName
    }
  }, [channelName])

  // Track the message list column width so the pre-allocated image
  // placeholder matches the actual rendered bubble column. We
  // only update once after mount; the column doesn't reflow
  // while the user is interacting with the chat, so a single
  // measurement is enough for the lifetime of the channel.
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const w = el.clientWidth
      if (w > 0) {
        // 65% of the column, capped at 26rem (same as the bubble).
        const bw = Math.min(w * 0.65, 26 * 16)
        setBubbleWidth(Math.max(220, bw))
      }
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const members = useMemo(() => {
    const seen = new Map<number, string>()
    for (const m of channelMembers ?? []) seen.set(m.id, m.display_name)
    if (nickByUserId) for (const [id, nick] of nickByUserId) seen.set(id, nick)
    return Array.from(seen, ([id, display_name]) => ({ id, display_name }))
  }, [channelMembers, nickByUserId])

  // Build the chronological display list once per render. The
  // virtualizer below picks a window out of this list. Source
  // order is oldest → newest; the chat container's
  // `flex-direction: column-reverse` does the visual inversion
  // at the container level only, so the slice itself stays in
  // chronological order. Day dividers are emitted just before
  // the first message of each new day, which renders the label
  // "above today's group" in the visible flow.
  const items = useMemo(
    () => buildDisplayList(messages, currentNick, nickByUserId ?? new Map(), bubbleWidth),
    [messages, currentNick, nickByUserId, bubbleWidth],
  )
  const totalItems = items.length

  // ponytail: defer the items array. When a live message lands
  // React rerenders, the virtualizer recomputes the window, and
  // every visible item rebuilds. useDeferredValue keeps that
  // cheap: the old window stays in the DOM while React computes
  // the new one, and the browser gets a single commit. The
  // scroll itself never moves because the new item is appended
  // to the end of the chronological list, which the column-
  // reverse container then places at the visual bottom without
  // any scroll adjustment.
  const deferredItems = useDeferredValue(items)
  const itemsForRender = deferredItems

  // ponytail: window selection. We keep the last 80 items around
  // the bottom of the list (the "tail"), with a 30-item overscan
  // upward so the top-sentinel has buffer to read. When the
  // state machine is FREE_SCROLL (i.e. the user is reading
  // history) we expand the window upward to cover the visible
  // region, computed from scrollTop. LOADING_HISTORY keeps the
  // last good window so the layout doesn't jump while the fetch
  // is in flight.
  const { startIdx, endIdx, topGap, bottomGap } = useMemo(() => {
    if (totalItems === 0) {
      return { startIdx: 0, endIdx: 0, topGap: 0, bottomGap: 0 }
    }
    const tail = Math.min(VIRTUAL_WINDOW, totalItems)
    const start = Math.max(0, totalItems - tail)
    const end = totalItems

    // ponytail: topGap represents the *unrendered* items above
    // the window (older history). It MUST be placed as the
    // first DOM child of the slice so it sits at the visual
    // top, not the visual bottom (where the column-reverse
    // container would push it and create the empty space the
    // user is seeing).
    let topH = 0
    for (let i = 0; i < start; i++) topH += itemsForRender[i].h
    let bottomH = 0
    return { startIdx: start, endIdx: end, topGap: topH, bottomGap: bottomH }
  }, [itemsForRender, totalItems])

  // ponytail: when a new history page lands, topGap grows because
  // startIdx dropped (more items above the window). Without a
  // scrollTop bump the user would visually jump downward. The
  // bump is "previous topGap - new topGap" added to scrollTop so
  // the first item of the window stays under the same pixel.
  // We do this after React commits, via useLayoutEffect, so the
  // DOM has the new placeholder height before we adjust.
  const prevTopGapRef = useRef(topGap)
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const prev = prevTopGapRef.current
    if (prev !== topGap) {
      // ponytail: only compensate upward growth of the top
      // placeholder. If the gap shrank (history fetch returned
      // 0 new items, just re-rendered) the user is already
      // closer to the top, no bump needed.
      const delta = topGap - prev
      if (delta > 0) el.scrollTop += delta
      prevTopGapRef.current = topGap
    }
  }, [topGap])

  // Render the window in chronological order. The chat container
  // is a flex column-reverse, but this slice is rendered inside
  // a regular block (`.irc-col-reverse` is `display: block`,
  // not column-reverse — the inversion is at the container level
  // only). So the slice flows top→bottom in source order, and
  // `column-reverse` on the parent places the whole block near
  // the visual bottom of the chat. Inside the block, oldest
  // messages sit at the top and the newest at the bottom, which
  // is the layout the user expects when they read the chat from
  // top to bottom.
  const windowItems = useMemo(
    () => itemsForRender.slice(startIdx, endIdx),
    [itemsForRender, startIdx, endIdx],
  )

  const handleMeasured = useCallback((id: number, h: number) => {
    setMeasuredHeight(id, h)
  }, [])

  // Scroll state machine: bottom sentinel + top sentinel
  // observers live in this hook. The slot refs are real DOM
  // elements rendered at the top and bottom of the column-
  // reverse flex; the IO uses them as markers.
  const onLoadMoreRef = useRef(onLoadMore)
  onLoadMoreRef.current = onLoadMore
  const onLoadMoreWrapped = useCallback(async () => {
    if (onLoadMoreRef.current) await onLoadMoreRef.current()
  }, [])
  const scroll = useScrollState({
    scrollEl: containerRef.current,
    onLoadMore: onLoadMoreWrapped,
  })

  // Auto-scroll: when a new live message lands, the state
  // machine handles three cases:
  //   - PINNED_BOTTOM: stay pinned, no badge.
  //   - FREE_SCROLL: bump the badge counter, leave the viewport
  //     alone.
  //   - LOADING_HISTORY: do nothing (the user is paging through
  //     history and a live message is irrelevant).
  // Own messages always force the viewport to the bottom; the
  // user just hit send and expects to see their line.
  const lastIdRef = useRef<number | null>(null)
  const onNewMessageRef = useRef(scroll.onNewMessage)
  onNewMessageRef.current = scroll.onNewMessage
  useLayoutEffect(() => {
    const last = messages.length > 0 ? messages[messages.length - 1] : null
    const prev = lastIdRef.current
    lastIdRef.current = last?.id ?? null
    if (!last || last.id === prev) return
    const isOwn = last.user_id === myUserId
    onNewMessageRef.current({ isOwn })
  }, [messages, myUserId])

  // On channel switch: jump to the bottom (scrollTop = 0) and
  // prime the seen-ids set so the whole channel doesn't animate
  // in. The double rAF catches late image / OG card layouts.
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    let raf2: number | null = null
    el.scrollTop = 0
    raf2 = requestAnimationFrame(() => requestAnimationFrame(() => { el.scrollTop = 0 }))
    return () => {
      if (raf2 !== null) cancelAnimationFrame(raf2)
    }
  }, [channelName])

  function openLink(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex-1 relative overflow-hidden">
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-y-auto irc-chat-scroll"
        style={{ overflowAnchor: 'none', display: 'flex', flexDirection: 'column-reverse' }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm gap-2">
            <span className="text-3xl opacity-30">💬</span>
            <span>No hay mensajes aún. Sé el primero.</span>
          </div>
        )}
        {/* ponytail: bottom sentinel must be the first DOM child
            so column-reverse renders it at the visual BOTTOM of
            the chat. When it scrolls into view the IO marks
            the user as PINNED_BOTTOM. */}
        <div ref={scroll.bottomSentinelRef} className="irc-sentinel irc-sentinel-bottom" style={{ height: 1, contain: 'layout paint' }} aria-hidden="true" />
        <div className="irc-col-reverse">
          {/* ponytail: topGap MUST be the first child of the
              slice. It represents the unrendered older history
              above the window. The slice is rendered top→bottom
              in source order, so a first child sits at the visual
              top of the block. Putting it at the END (as the
              previous code did) was the root cause of the empty
              space the user was seeing at the bottom: the
              column-reverse container would push the giant
              placeholder below the last message. */}
          {topGap > 0 && (
            <div
              className="irc-virtual-gap-top"
              style={{ height: topGap, contain: 'layout paint' }}
              aria-hidden="true"
            />
          )}
          {windowItems.map((item) => {
            if (item.type === 'day') {
              return <DayHeader key={item.id} ts={item.message.created_at * 1000} />
            }
            const id = item.message.id
            const isNew = !seenIdsRef.current.has(id)
            if (isNew) seenIdsRef.current.add(id)
            // ponytail: showHeader detection needs the previous
            // bubble in chronological order, skipping any day
            // divider that may sit between them. windowItems is
            // the chronological slice, so the previous bubble
            // is just before this one in windowItems.
            let prevBubble: { user_id: number; content: string; is_action?: boolean; created_at: number } | null = null
            for (let j = windowItems.indexOf(item) - 1; j >= 0; j--) {
              const w = windowItems[j]
              if (w.type === 'bubble') { prevBubble = w.message; break }
            }
            const showHeader = !prevBubble
              || prevBubble.user_id !== item.message.user_id
              || !!prevBubble.is_action !== !!item.message.is_action
              || hasImageMarker(prevBubble.content) !== hasImageMarker(item.message.content)
              || item.message.created_at - prevBubble.created_at > HEADER_INTERVAL_S
            return (
              <MessageRow
                key={item.id}
                message={item.message}
                showHeader={showHeader}
                isOwn={item.isOwn}
                isNew={isNew}
                members={members}
                nickByUserId={nickByUserId}
                myUserId={myUserId}
                onImageOpen={(images, idx) => setLightbox({ images, index: idx })}
                onLinkOpen={openLink}
                onContextMenu={(msg, x, y) => {
                  const target = channelMembers?.find(m => m.id === msg.user_id)
                  setContextMenu({ show: true, x, y, message: msg, isOwn: item.isOwn, isTargetOnline: target?.active ?? false })
                }}
                onToggleReaction={onToggleReaction}
                onVideoFloat={onVideoFloat}
                onVideoPlay={onVideoPlay}
                onVideoRef={onVideoRef}
                floatingVideo={floatingVideo}
                onMeasured={handleMeasured}
              />
            )
          })}
          {bottomGap > 0 && (
            <div
              className="irc-virtual-gap-bottom"
              style={{ height: bottomGap, contain: 'layout paint' }}
              aria-hidden="true"
            />
          )}
        </div>
        {hasMore === false && messages.length > 0 && (
          <div className="irc-end-marker flex justify-center py-3 text-[11px] text-slate-600">
            — inicio del canal —
          </div>
        )}
        {hasMore !== false && (
          <div className="irc-loader flex justify-center py-2 text-xs text-slate-500 min-h-[2.25rem]">
            {loadingMore && (
              <span className="inline-flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                cargando mensajes anteriores…
              </span>
            )}
          </div>
        )}
        {/* ponytail: top sentinel at the end of the DOM, which
            column-reverse renders at the visual TOP of the chat.
            When it enters the viewport the IO transitions to
            LOADING_HISTORY. The 1px height is a deliberate
            minimum so the IO fires as soon as the user reaches
            the very top. */}
        <div ref={scroll.topSentinelRef} className="irc-sentinel irc-sentinel-top" style={{ height: 1, contain: 'layout paint' }} aria-hidden="true" />
      </div>
      <NewMessagesBadge count={scroll.pendingCount} onClick={scroll.jumpToBottom} />
      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          index={lightbox.index}
          onIndexChange={(i) => setLightbox(prev => prev ? { ...prev, index: i } : null)}
          onClose={() => setLightbox(null)}
        />
      )}
      <MessageContextMenu
        state={contextMenu}
        onClose={closeContextMenu}
        onReact={(messageId, emoji) => {
          onToggleReaction?.(messageId, emoji)
          closeContextMenu()
        }}
        onReply={(msg) => onReply?.(msg)}
        onForward={(msg) => onForward?.(msg)}
        onBuzz={(targetUserId) => onBuzz?.(targetUserId)}
        onCopyText={(text) => onCopyText?.(text)}
        myRole={myRole}
        onHide={onHide}
        onDelete={onDelete}
        onCopyImage={onCopyImage}
        onDownloadImage={onDownloadImage}
        onDownloadAttachment={onDownloadAttachment}
        onCopyLink={onCopyLink}
        onEdit={onEdit}
        editWindowSeconds={editWindowSeconds}
      />
    </div>
  )
}
