import { useCallback, useRef } from 'react'

interface UseLongPressOptions {
  /**
   * Called after the touch is held for `delay` ms without
   * significant movement. Receives the originating touch event
   * so the caller can read `touch.clientX / clientY` for
   * positioning the menu.
   */
  onLongPress: (e: React.TouchEvent) => void
  /** Hold time in ms. 400 ms matches iOS Safari's native
   *  long-press threshold, which keeps the gesture feeling
   *  native on both iOS and Android. */
  delay?: number
  /** Maximum finger travel in px before the long-press is
   *  cancelled. Without this, scrolling the chat would also
   *  open the menu. */
  moveThresholdPx?: number
}

interface LongPressHandlers {
  onTouchStart: (e: React.TouchEvent) => void
  onTouchMove: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
  onTouchCancel: (e: React.TouchEvent) => void
}

interface UseLongPressResult extends LongPressHandlers {
  /**
   * ponytail: drain the long-press flag. Call this from
   * `onClick` to suppress the synthetic click that browsers
   * fire when a touch ends. Returns `true` if a long-press
   * just fired on this element (so the click should be
   * ignored) and resets the flag.
   *
   * The flag only fires for touch-initiated long-presses, so
   * mouse users on desktop are unaffected.
   */
  consumeLongPressClick: () => boolean
}

/**
 * ponytail: mobile long-press handling. iOS Safari does NOT
 * fire `contextmenu` from a touch, and the shell-wide
 * contextmenu preventDefault (App.tsx) suppresses the native
 * menu everywhere. Without this hook the touch path is silent
 * and the menu only works on desktop.
 *
 * The hook returns touch handlers that should be spread onto
 * the interactive element alongside the consumer's own
 * `onContextMenu` (for desktop right-click) and `onClick`. The
 * touch path tracks the starting coordinates and cancels on
 * movement past `moveThresholdPx` so scrolling never opens the
 * menu.
 *
 * When a long-press fires, the next click is suppressed via
 * `consumeLongPressClick` so a touch that ended in a
 * long-press does NOT also trigger the element's onClick (e.g.
 * a channel row being both selected and menu-opened).
 */
export function useLongPress({
  onLongPress,
  delay = 400,
  moveThresholdPx = 10,
}: UseLongPressOptions): UseLongPressResult {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  // ponytail: set when a long-press fires, cleared when the
  // consumer drains it via consumeLongPressClick. Lives
  // across the touchend → click sequence so a synthetic click
  // can be suppressed.
  const firedRef = useRef(false)
  // ponytail: keep the latest callback in a ref so a new
  // `onLongPress` identity doesn't re-trigger every handler
  // that the consumer spread onto the element.
  const cbRef = useRef(onLongPress)
  cbRef.current = onLongPress

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    startRef.current = null
  }, [])

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const t = e.touches[0]
      if (!t) return
      firedRef.current = false
      startRef.current = { x: t.clientX, y: t.clientY }
      clear()
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        startRef.current = null
        firedRef.current = true
        cbRef.current(e)
      }, delay)
    },
    [delay, clear],
  )

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const start = startRef.current
      if (!start) return
      const t = e.touches[0]
      if (!t) return
      const dx = t.clientX - start.x
      const dy = t.clientY - start.y
      if (dx * dx + dy * dy > moveThresholdPx * moveThresholdPx) {
        clear()
      }
    },
    [moveThresholdPx, clear],
  )

  const onTouchEnd = useCallback(() => {
    // ponytail: do NOT clear `firedRef` here. The browser
    // synthesises a click after touchend, and consumeLongPressClick
    // (called from onClick) reads and clears the flag.
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    startRef.current = null
  }, [])

  const onTouchCancel = useCallback(() => {
    clear()
    firedRef.current = false
  }, [clear])

  const consumeLongPressClick = useCallback(() => {
    if (!firedRef.current) return false
    firedRef.current = false
    return true
  }, [])

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel,
    consumeLongPressClick,
  }
}
