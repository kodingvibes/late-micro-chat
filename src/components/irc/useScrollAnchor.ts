import { useRef, useCallback } from 'react'

interface Anchor {
  /** The id of the message element that was closest to the viewport edge. */
  id: number
  /** Distance from the top of that element to the top of the container. */
  offset: number
}

/**
 * Keeps the scroll position visually stable when the list content changes
 * size (history load, lazy images mounting, etc.). Before the change, save
 * an anchor; after the change, restore it. This replaces the previous
 * scroll-height-delta approach which broke when the user scrolled while the
 * content was still settling.
 *
 * If the user is within `bottomThreshold` px of the bottom, returning null
 * lets the caller decide to stick to the bottom instead.
 */
export function useScrollAnchor() {
  const pendingAnchorRef = useRef<Anchor | null>(null)

  const capture = useCallback((container: HTMLElement, bottomThreshold = 120): Anchor | null => {
    if (!container) return null
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight
    if (distance <= bottomThreshold) {
      return null // caller should stay at bottom
    }

    // Find the first message row that is at or below the current scrollTop.
    const rows = container.querySelectorAll<HTMLElement>('[id^="msg-"]')
    let best: { id: number; offset: number; top: number } | null = null
    for (const row of rows) {
      const top = row.offsetTop - container.offsetTop
      if (top >= container.scrollTop) {
        const id = Number(row.id.replace('msg-', ''))
        if (!isNaN(id)) {
          best = { id, offset: container.scrollTop - top, top }
        }
        break
      }
    }
    return best
  }, [])

  const save = useCallback((container: HTMLElement | null, bottomThreshold = 120) => {
    pendingAnchorRef.current = container ? capture(container, bottomThreshold) : null
  }, [capture])

  const restore = useCallback((container: HTMLElement | null, immediate = false) => {
    const anchor = pendingAnchorRef.current
    pendingAnchorRef.current = null
    if (!container || !anchor) return

    const apply = () => {
      const target = container.querySelector<HTMLElement>(`#msg-${anchor.id}`)
      if (!target) return
      const newTop = target.offsetTop - container.offsetTop
      const nextScrollTop = newTop + anchor.offset
      container.scrollTop = nextScrollTop
    }

    apply()
    if (immediate) {
      // Double-layout content (lazy mounts that resize over two frames)
      // can shift again right after restore. Re-apply once more after paint.
      requestAnimationFrame(() => requestAnimationFrame(apply))
    }
  }, [])

  return { save, restore }
}
