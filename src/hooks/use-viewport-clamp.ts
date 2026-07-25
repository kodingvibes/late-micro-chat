import {
  useLayoutEffect,
  useState,
  useRef,
  type RefObject,
  type CSSProperties,
} from 'react'

export interface ViewportClampOptions {
  /** Spacing (px) between the menu and the viewport edges. */
  margin?: number
  /**
   * Estimated size of the menu before it is measured. Used on
   * the first frame so the menu can be pre-positioned offscreen
   * at the correct size, painted, measured for real, and then
   * snapped to the clamped coordinates. Defaults to a small
   * context-menu guess; the real measurement replaces it after
   * one rAF. Without an estimate the menu would render at
   * (0,0) briefly, which is what causes the visible "jitter"
   * the user reported.
   */
  estimatedSize?: { width: number; height: number }
  /** If true, prefer placing above the origin when it overflows the bottom. */
  allowFlipVertical?: boolean
  /** If true, prefer placing to the left of the origin when it overflows the right. */
  allowFlipHorizontal?: boolean
  /** z-index for the positioned menu. */
  zIndex?: number
}

export interface ClampedPosition {
  /**
   * Style to apply to the menu container. Combines the clamped
   * position, opacity, and pointer-events gate. The consumer
   * spreads this onto the root div and is done with positioning.
   *
   * ponytail: until the clamp finishes measuring, the menu is
   * parked offscreen with visibility:hidden so the browser can
   * measure its real size. The user never sees that frame.
   * When ready becomes true the style snaps to the final
   * coordinates with opacity:1; the entry animation is driven
   * by the `data-state="open"` attribute the consumer sets at
   * the same time (see the matching CSS keyframe).
   */
  style: CSSProperties
  /**
   * True once the menu has been rendered offscreen, measured,
   * and positioned at the final coordinates. Consumers should
   * set `data-state="open"` on the root when this is true so
   * the CSS entry animation fires.
   */
  ready: boolean
  /**
   * Direction the menu is placed relative to the origin:
   *   "down" — the menu sits below the origin (default for
   *     right-click on a list item; the origin is the cursor).
   *   "up"   — the menu sits above the origin (used when there
   *     isn't room below and `allowFlipVertical` is on).
   *
   * Drives the slide direction of the entry animation. The
   * consumer reads this from the `data-placement` attribute on
   * the root and the CSS picks the matching keyframe.
   */
  placement: 'down' | 'up'
}

/**
 * Clamp a floating element's position so it stays within the viewport.
 *
 * ponytail: the previous implementation rendered the menu at the
 * origin coordinates, then waited two rAFs to measure the painted
 * size, then jumped the menu to the clamped coordinates. That
 * jump is what the user described as "jitter". The fix is to
 * pre-position the menu offscreen (top: -9999px) with a reasonable
 * estimated size, let the browser paint and measure it, then
 * snap to the final clamped position. The style object returned
 * here handles both phases — offscreen-and-hidden while measuring,
 * final-coords-and-visible once ready — so the consumer can
 * `style={clamp.style}` and forget about positioning.
 */
export function useViewportClamp(
  ref: RefObject<HTMLElement | null>,
  originX: number,
  originY: number,
  visible: boolean,
  options: ViewportClampOptions = {}
): ClampedPosition {
  const {
    margin = 8,
    estimatedSize = { width: 200, height: 240 },
    allowFlipVertical = true,
    allowFlipHorizontal = true,
    zIndex = 250,
  } = options
  const [state, setState] = useState<{
    x: number
    y: number
    ready: boolean
    placement: 'down' | 'up'
  }>({ x: originX, y: originY, ready: false, placement: 'down' })
  const rafRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    if (!visible) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      setState({ x: originX, y: originY, ready: false, placement: 'down' })
      return
    }

    const measure = () => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const vpW = window.innerWidth
      const vpH = window.innerHeight
      const w = Math.max(rect.width, estimatedSize.width)
      const h = Math.max(rect.height, estimatedSize.height)

      let x = originX
      let y = originY
      let placement: 'down' | 'up' = 'down'

      if (allowFlipHorizontal && x + w + margin > vpW && x - w - margin >= 0) {
        x = x - w - margin
      }
      if (allowFlipVertical && y + h + margin > vpH && y - h - margin >= 0) {
        y = y - h - margin
        placement = 'up'
      }
      x = Math.max(margin, Math.min(x, vpW - w - margin))
      y = Math.max(margin, Math.min(y, vpH - h - margin))

      setState({ x, y, ready: true, placement })
    }

    // First rAF: kick the offscreen paint. Second rAF: measure
    // and snap. Two commits are enough because the menu is
    // already laid out (we never unmounted it between opens —
    // the consumer keeps the same ref alive).
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(measure)
    })

    const onResize = () => {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(measure)
      })
    }
    window.addEventListener('resize', onResize)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      window.removeEventListener('resize', onResize)
    }
  }, [visible, originX, originY, margin, allowFlipHorizontal, allowFlipVertical, ref, estimatedSize.width, estimatedSize.height])

  // ponytail: build the style from the current state. While
  // measuring, the menu is parked offscreen with visibility:hidden
  // and opacity:0 so the user can't see it. After the snap the
  // style carries the final coordinates and opacity:1, and the
  // consumer's CSS keyframe handles the entry animation from
  // there. The `data-placement` attribute on the root selects
  // the matching keyframe (slide-down for "down", slide-up for
  // "up").
  const style: CSSProperties = state.ready
    ? {
        position: 'fixed',
        left: state.x,
        top: state.y,
        zIndex,
        opacity: 1,
        visibility: 'visible',
      }
    : {
        position: 'fixed',
        left: -9999,
        top: -9999,
        zIndex,
        opacity: 0,
        visibility: 'hidden',
      }

  return { style, ready: state.ready, placement: state.placement }
}
