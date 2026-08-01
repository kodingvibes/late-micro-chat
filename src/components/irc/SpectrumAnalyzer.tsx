import { useRef, useEffect } from 'react'
import { getOrCreateAudioContext } from '../../voice/audioContext'

interface SpectrumAnalyzerProps {
  stream: MediaStream | null
  active: boolean
  barCount?: number
  className?: string
}

export default function SpectrumAnalyzer({
  stream, active, barCount = 16, className = '',
}: SpectrumAnalyzerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (!stream || !active) {
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
      }
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    // ponytail: shared singleton, not a per-tile `new AudioContext()`.
    // See useAudioLevel for why: one context per tile blew past the
    // browser limit and, being built outside the join gesture, started
    // suspended on iOS and never rendered a frame.
    const ctx = getOrCreateAudioContext()
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 64
    source.connect(analyser)

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const draw = () => {
      const canvasCtx = canvas.getContext('2d')
      if (!canvasCtx) return
      const w = canvas.width
      const h = canvas.height

      analyser.getByteFrequencyData(dataArray)

      canvasCtx.clearRect(0, 0, w, h)

      const barWidth = w / barCount
      let sum = 0
      for (let i = 0; i < barCount; i++) {
        const idx = Math.floor((i / barCount) * bufferLength)
        const value = dataArray[idx] / 255
        sum += value
        const barH = value * h
        canvasCtx.fillStyle = `rgba(52, 211, 153, ${0.3 + value * 0.7})`
        canvasCtx.fillRect(i * barWidth, h - barH, Math.max(barWidth - 1, 1), barH)
      }

      const avg = sum / barCount
      if (avg > 0.02) {
        rafRef.current = requestAnimationFrame(draw)
      } else {
        canvasCtx.clearRect(0, 0, w, h)
        rafRef.current = requestAnimationFrame(draw)
      }
    }
    draw()

    return () => {
      cancelAnimationFrame(rafRef.current)
      source.disconnect()
      // Never close the shared context: it is the singleton the mic
      // graph and every other tile are still using.
    }
  }, [stream, active, barCount])

  return (
    <canvas
      ref={canvasRef}
      width={80}
      height={20}
      className={`rounded-sm ${className}`}
    />
  )
}
