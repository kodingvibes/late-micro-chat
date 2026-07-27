import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X, Download, Copy } from '@/components/icons'

export function ImageContextMenuPortal({
  url, x, y, onClose,
}: {
  url: string; x: number; y: number; onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
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
  }, [onClose])

  const handleCopy = async () => {
    try {
      const resp = await fetch(url)
      const blob = await resp.blob()
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
    } catch {}
    onClose()
  }

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = url
    a.download = 'imagen.webp'
    a.click()
    onClose()
  }

  const menuW = 180
  const vpW = window.innerWidth
  const vpH = window.innerHeight
  const left = Math.min(x, vpW - menuW - 8)
  const top = Math.min(y, vpH - 80 - 8)

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[310] bg-surface-2 border border-accent/20 rounded-xl shadow-2xl py-1 min-w-[180px] overflow-hidden select-none animate-menu-pop"
      style={{ left, top }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={handleCopy}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-surface-2 transition-colors"
      >
        <Copy className="w-4 h-4 text-accent" />
        Copiar imagen
      </button>
      <button
        type="button"
        onClick={handleDownload}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-surface-2 transition-colors"
      >
        <Download className="w-4 h-4 text-accent" />
        Descargar imagen
      </button>
    </div>,
    document.body,
  )
}

interface ImagePreviewProps {
  dataUrl: string
  onOpen: (src: string) => void
  width?: number | null
  height?: number | null
}

const IMG_MAX_H = 288

// ponytail: when the server tells us the real image dimensions
// (AttachmentMeta.width/height) we render an <img> with width/
// height HTML attributes. The browser reserves the final box
// before the bytes hit, so the row never reflows. Without the
// metadata we fall back to max-h-72 (288px) which is the previous
// behavior. The cap also clips server-known images that would
// otherwise blow past max-h-72 on narrow columns.
function fittedDims(w: number | null | undefined, h: number | null | undefined, maxW: number) {
  if (!w || !h || w <= 0 || h <= 0) return null
  const capW = Math.max(120, Math.min(maxW, w))
  const ratio = w / h
  const outH = Math.min(IMG_MAX_H, Math.round(capW / ratio))
  return { w: capW, h: outH }
}

export default function ImagePreview({ dataUrl, onOpen, width, height }: ImagePreviewProps) {
  const dims = fittedDims(width, height, 512)
  return (
    <button
      onClick={() => onOpen(dataUrl)}
      className="block rounded-lg overflow-hidden border border-accent/20 hover:border-accent transition-colors"
      aria-label="Abrir imagen"
      style={{ contain: 'layout paint' }}
    >
      {dims ? (
        <img
          src={dataUrl}
          alt="imagen pegada"
          width={dims.w}
          height={dims.h}
          className="block max-w-full object-contain bg-surface-1"
          style={{ height: dims.h, width: dims.w }}
          loading="lazy"
          draggable={false}
        />
      ) : (
        <img
          src={dataUrl}
          alt="imagen pegada"
          className="block max-w-full max-h-72 object-contain bg-surface-1"
          loading="lazy"
          draggable={false}
        />
      )}
    </button>
  )
}

interface ImageGalleryProps {
  images: string[]
  onOpen: (index: number) => void
}

export function ImageGallery({ images, onOpen }: ImageGalleryProps) {
  if (images.length === 0) return null
  if (images.length === 1) {
    return (
      <button
        onClick={() => onOpen(0)}
        className="block rounded-lg overflow-hidden border border-accent/20 hover:border-accent transition-colors"
        aria-label="Abrir galería"
        style={{ contain: 'layout paint' }}
      >
        <img
          src={images[0]}
          alt=""
          className="block max-w-full max-h-72 object-contain bg-surface-1"
          loading="lazy"
          draggable={false}
        />
      </button>
    )
  }

  const MAX_GALLERY = 4
  const visible = images.slice(0, MAX_GALLERY)
  const extra = images.length - MAX_GALLERY

  return (
    <div className="flex flex-col gap-1.5 max-w-full">
      <div className="relative">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
          {visible.map((url, i) => (
            <button
              key={i}
              onClick={() => onOpen(i)}
              className="flex-shrink-0 rounded-md overflow-hidden border border-accent/20 hover:border-accent transition-colors relative"
              aria-label={`Ir a imagen ${i + 1}`}
            >
              <img
                src={url}
                alt=""
                className="block w-20 h-20 sm:w-24 sm:h-24 object-cover bg-surface-1"
                loading="lazy"
                draggable={false}
              />
              {i === visible.length - 1 && extra > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-sm font-bold">
                  +{extra}
                </div>
              )}
            </button>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-slate-950 to-transparent" />
      </div>
    </div>
  )
}

interface ImageLightboxProps {
  images: string[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
}

export function ImageLightbox({ images, index, onIndexChange, onClose }: ImageLightboxProps) {
  const [ctxMenu, setCtxMenu] = useState<{ url: string; x: number; y: number } | null>(null)
  const dragStartXRef = useRef(0)
  const imageRef = useRef<HTMLImageElement>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFiredRef = useRef(false)

  const hasPrev = index > 0
  const hasNext = index < images.length - 1

  const prev = useCallback(() => {
    if (hasPrev) {
      setCtxMenu(null)
      onIndexChange(index - 1)
    }
  }, [hasPrev, index, onIndexChange])

  const next = useCallback(() => {
    if (hasNext) {
      setCtxMenu(null)
      onIndexChange(index + 1)
    }
  }, [hasNext, index, onIndexChange])

  useEffect(() => {
    if (images.length === 0) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (longPressTimerRef.current !== null) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }
    }
  }, [images, onClose, prev, next])

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  useEffect(() => {
    setCtxMenu(null)
  }, [index])

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 1) return
    const touch = e.touches[0]
    dragStartXRef.current = touch.clientX
    longPressFiredRef.current = false
    clearLongPress()
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true
      setCtxMenu({ url: images[index], x: touch.clientX, y: touch.clientY })
    }, 500)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (longPressTimerRef.current !== null) {
      const dx = e.touches[0].clientX - dragStartXRef.current
      if (Math.abs(dx) > 8) clearLongPress()
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    clearLongPress()
    const dx = e.changedTouches[0].clientX - dragStartXRef.current
    if (Math.abs(dx) > 50) {
      if (dx > 0) prev()
      else next()
    }
  }

  if (images.length === 0) return null

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none animate-menu-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-slate-800/80 hover:bg-surface-2 text-white flex items-center justify-center text-xl z-10"
        aria-label="Cerrar"
      >
        <X className="w-5 h-5" />
      </button>

      {images.length > 1 && (
        <span className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-800/80 text-slate-300 text-xs px-2.5 py-1 rounded-full z-10">
          {index + 1} / {images.length}
        </span>
      )}

      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); prev() }}
          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-800/80 hover:bg-surface-2 text-white flex items-center justify-center transition-colors z-10"
          aria-label="Anterior"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); next() }}
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-800/80 hover:bg-surface-2 text-white flex items-center justify-center transition-colors z-10"
          aria-label="Siguiente"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      <div
        className="flex items-center justify-center w-full h-full"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setCtxMenu({ url: images[index], x: e.clientX, y: e.clientY })
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          ref={imageRef}
          key={index}
          src={images[index]}
          alt=""
          className="max-w-full max-h-full object-contain select-none"
          draggable={false}
        />
      </div>
      {ctxMenu && (
        <ImageContextMenuPortal
          url={ctxMenu.url}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  )
}
