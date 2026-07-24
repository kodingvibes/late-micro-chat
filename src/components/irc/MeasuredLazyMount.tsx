import { useEffect, useRef, useState } from 'react'

interface MeasuredLazyMountProps {
  /** Height used while the item has not been measured yet. */
  estimatedHeight?: number
  /** If provided, measurement uses this width. Otherwise the component measures its own placeholder width. */
  width?: number
  rootMargin?: string
  /** Max time to wait for async content (images, audio decode) before swapping anyway. */
  measureTimeoutMs?: number
  children: React.ReactNode
}

/**
 * Lazy-mounts heavy children after measuring them offscreen at the same width
 * they will have in the message list. The placeholder is resized to the real
 * height before the swap, so the container does not jump when the content
 * mounts. This eliminates the scroll jitter caused by link previews, audio
 * waveforms and voice note players inflating after their initial placeholder.
 */
export default function MeasuredLazyMount({
  estimatedHeight = 40,
  width,
  rootMargin = '200px',
  measureTimeoutMs = 3000,
  children,
}: MeasuredLazyMountProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const measureRef = useRef<HTMLDivElement | null>(null)
  const placeholderRef = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null)
  const [swapped, setSwapped] = useState(false)
  const [placeholderWidth, setPlaceholderWidth] = useState<number>(width ?? 0)

  // Track the effective width we will measure at.
  const effectiveWidth = width ?? placeholderWidth

  // Observe placeholder width when no explicit width is provided.
  useEffect(() => {
    if (width !== undefined) return
    const el = placeholderRef.current ?? wrapperRef.current
    if (!el) return
    const update = () => setPlaceholderWidth(el.clientWidth)
    update()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update)
      return () => window.removeEventListener('resize', update)
    }
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [width])

  // IntersectionObserver: decide when to start measuring.
  useEffect(() => {
    const el = placeholderRef.current ?? wrapperRef.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.disconnect()
            break
          }
        }
      },
      { rootMargin },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [rootMargin])

  // Measure the offscreen copy and swap once we have a stable height.
  useEffect(() => {
    if (!visible || effectiveWidth <= 0) return
    const measureEl = measureRef.current
    if (!measureEl) return

    let cancelled = false
    let timeout: ReturnType<typeof setTimeout> | null = null

    const commitHeight = (h: number) => {
      if (cancelled || h <= 0) return
      // Resize placeholder and swap atomically in one React commit so the
      // container never sees a placeholder shorter than the real content.
      setMeasuredHeight(h)
      setSwapped(true)
    }

    const readHeight = () => {
      const h = measureEl.clientHeight
      if (h > 0) commitHeight(h)
    }

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const h = entry.borderBoxSize?.[0]?.blockSize ?? measureEl.clientHeight
          if (h > 0) {
            ro.disconnect()
            if (timeout) clearTimeout(timeout)
            commitHeight(h)
            break
          }
        }
      })
      ro.observe(measureEl)
      timeout = setTimeout(() => {
        ro.disconnect()
        readHeight()
      }, measureTimeoutMs)
      return () => {
        cancelled = true
        ro.disconnect()
        if (timeout) clearTimeout(timeout)
      }
    }

    // Fallback: wait a couple of rAFs for layout, then read height.
    timeout = setTimeout(() => readHeight(), 100)
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(readHeight)
      timeout = setTimeout(() => cancelAnimationFrame(raf2), measureTimeoutMs)
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf1)
      if (timeout) clearTimeout(timeout)
    }
  }, [visible, effectiveWidth, measureTimeoutMs])

  const currentMinHeight = measuredHeight ?? estimatedHeight

  return (
    <div ref={wrapperRef} className="relative min-w-0">
      {!swapped && visible && effectiveWidth > 0 && (
        <div
          ref={measureRef}
          className="pointer-events-none"
          style={{
            position: 'fixed',
            top: '-100vh',
            left: '-100vw',
            opacity: 0,
            zIndex: -1,
            width: effectiveWidth,
          }}
          aria-hidden="true"
        >
          {children}
        </div>
      )}
      <div ref={placeholderRef} style={swapped ? undefined : { minHeight: currentMinHeight }}>
        {swapped ? children : null}
      </div>
    </div>
  )
}
