import type { ChatMessage } from '../../lib/chat/domain/types'
import { hasImageMarker, getAttachmentMarker } from '../../lib/chat/domain/parsers'

// ponytail: per-message height cache for virtualization. We only
// render a window of messages at a time and replace the rest with a
// single placeholder whose height is the sum of every known
// message height in the gap. That requires us to know every
// message's height before we render it the first time, so we keep
// a permanent cache keyed by message id and back it with cheap
// estimators on first lookup.

const cache = new Map<number, number>()

export function setMeasuredHeight(id: number, height: number) {
  if (!isFinite(height) || height <= 0) return
  cache.set(id, Math.round(height))
}

export function getCachedHeight(id: number): number | undefined {
  return cache.get(id)
}

export function clearHeights() {
  cache.clear()
}

// ponytail: rough pre-render estimate. Used until the real row has
// been measured once. The goal isn't pixel-perfect — it's a height
// close enough that virtualization never inserts an obvious gap
// while a row is still being measured. Tune from real layouts.
const LINE_HEIGHT = 22
const TEXT_PAD = 32 // px-3 py-1 + breathing room
const HEADER = 22
const TIMESTAMP = 14
const DAY_DIVIDER = 36
const AUDIO = 120
const ACTION = 24
const IMAGE_GALLERY_ROW = 96
const VIDEO_CARD = 200
const DOC_CARD = 72
const REACTION_ROW = 24
const REPLY_BLOCK = 28

function estimateTextLines(text: string, maxCharsPerLine = 50): number {
  if (!text) return 1
  let lines = 0
  for (const raw of text.split('\n')) {
    const len = raw.length
    if (len === 0) {
      lines += 1
    } else {
      lines += Math.max(1, Math.ceil(len / maxCharsPerLine))
    }
  }
  return lines
}

export function estimateMessageHeight(msg: ChatMessage, bubbleWidth: number): number {
  if (msg.is_action) return ACTION + 8

  const hasImage = hasImageMarker(msg.content)
  const att = !hasImage ? getAttachmentMarker(msg.content) : null
  const showHeader = true // worst case; rarely more than 1 line
  let h = TEXT_PAD + TIMESTAMP + 8

  if (showHeader) h += HEADER

  // Reply cite (small block above the bubble)
  if (msg.reply_to && msg.reply_to_author) h += REPLY_BLOCK + 4

  if (hasImage) {
    // ponytail: the server is the source of truth for image
    // dimensions (AttachmentMeta.width/height). Without that we
    // fall back to a 4:3 placeholder sized to bubbleWidth. The
    // cap mirrors the current max-h-72 (288px) used in
    // ImagePreview so the estimate matches what the row actually
    // ends up at.
    const cap = 288
    const meta = msg.attachment
    if (meta?.width && meta?.height && meta.width > 0) {
      const maxW = Math.max(120, bubbleWidth)
      const ratio = meta.width / meta.height
      const w = Math.min(maxW, meta.width)
      const imageH = Math.round(w / ratio)
      h += Math.min(cap, imageH) + 8
    } else {
      const w = Math.max(120, bubbleWidth)
      h += Math.min(cap, Math.round(w * (3 / 4))) + 8
    }
  } else if (att) {
    if (att.kind === 'voicenote' || att.kind === 'audio') {
      h += AUDIO + 8
    } else if (att.kind === 'image') {
      h += IMAGE_GALLERY_ROW + 8
    } else if (att.kind === 'video') {
      h += VIDEO_CARD + 8
    } else {
      h += DOC_CARD + 8
    }
  } else {
    h += estimateTextLines(msg.content) * LINE_HEIGHT
  }

  if (msg.reactions && msg.reactions.length > 0) h += REACTION_ROW + 4
  return Math.max(40, h)
}

export function estimateDayDividerHeight(): number {
  return DAY_DIVIDER
}
