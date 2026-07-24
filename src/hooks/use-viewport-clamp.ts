import { useLayoutEffect, useState, useRef, type RefObject } from 'react'

export interface ViewportClampOptions {
  /** Spacing (px) between the menu and the viewport edges. */
  margin?: number
  /** If true, prefer placing above the origin when it overflows the bottom. */
  allowFlipVertical?: boolean
  /** If true, prefer placing to the left of the origin when it overflows the right. */
  allowFlipHorizontal?: boolean
}

export interface ClampedPosition {
  x: number
  y: number
}

/**
 * Clamp a floating element's position so it stays within the viewport.
 * It measures the actual element size instead of guessing, which is
 * important when menu content is dynamic (emoji picker, admin actions,
 * delete confirmation, etc.).
 */
export function useViewportClamp(
  ref: RefObject<HTMLElement | null>,
  originX: number,
  originY: number,
  visible: boolean,
  options: ViewportClampOptions = {}
): ClampedPosition {
  const { margin = 8, allowFlipVertical = true, allowFlipHorizontal = true } = options
  const [pos, setPos] = useState<ClampedPosition>({ x: originX, y: originY })
  const rafRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    if (!visible) {
      setPos({ x: originX, y: originY })
      return
    }

    const clamp = () => {
      const el = ref.current
      if (!el) return

      const rect = el.getBoundingClientRect()
      const vpW = window.innerWidth
      const vpH = window.innerHeight
      const w = rect.width
      const h = rect.height

      let x = originX
      let y = originY

      if (allowFlipHorizontal && x + w + margin > vpW && x - w - margin >= 0) {
        x = x - w - margin
      }
      if (allowFlipVertical && y + h + margin > vpH && y - h - margin >= 0) {
        y = y - h - margin
      }

      x = Math.max(margin, Math.min(x, vpW - w - margin))
      y = Math.max(margin, Math.min(y, vpH - h - margin))

      setPos({ x, y })
    }

    // Two rAFs give the browser time to paint the initial layout so we
    // can measure the real rendered size (including dynamic content).
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(clamp)
    })

    const onResize = () => clamp()
    window.addEventListener('resize', onResize)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', onResize)
    }
  }, [visible, originX, originY, margin, allowFlipHorizontal, allowFlipVertical, ref])

  return pos
}
