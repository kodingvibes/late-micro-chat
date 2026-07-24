import { useEffect, useRef, useState } from 'react'

interface LazyMountProps {
  rootMargin?: string
  /** Height the placeholder reserves while the child is not mounted.
   *  Use this to match the expected real height and avoid layout jumps.
   */
  minHeight?: number
  children: React.ReactNode
}

/**
 * Defers mounting of heavy children (audio waveforms that fetch+decode
 * on mount, link previews, images) until the placeholder is near the
 * viewport. Without this, every audio in the loaded history fetches
 * and decodes in parallel on channel open, inflating the container
 * and pushing the last messages off-screen.
 */
export default function LazyMount({ rootMargin = '200px', minHeight = 40, children }: LazyMountProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
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
      { rootMargin }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [rootMargin])

  return (
    <div ref={ref} style={visible ? undefined : { minHeight }}>
      {visible ? children : null}
    </div>
  )
}

/** Choose a placeholder height for lazy content based on the message body. */
export function estimateLazyHeight(content: string): number {
  const c = content
  // Image(s) render with a 288px max-height container.
  if (c.includes('__late_image__:') || c.includes('__late_images__:') || c.includes('late_image__:') || c.includes('late_images__:')) {
    return 288
  }
  // OG preview cards are a 16:9 banner (~160px in a typical bubble width)
  // plus text lines. 168px is a good average.
  return 168
}
