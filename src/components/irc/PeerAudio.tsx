import { useEffect, useRef } from 'react'

/**
 * Plays one peer's remote audio.
 *
 * This used to live inside ParticipantTile, which meant playback was
 * tied to the tile being on screen. Once the call could collapse into
 * the bottom bar the tiles unmount, their cleanup paused the element,
 * and you went deaf the moment you opened a text channel -- still
 * connected, still receiving RTP, just with nothing playing it. Audio
 * has to outlive the view that draws the participant, so it renders
 * from VoiceRoomView in both the expanded and collapsed states.
 *
 * The element is deliberately never attached to the document: it is a
 * sink, not UI, and appending it would let page CSS and layout touch
 * something that must keep playing while hidden.
 */
export default function PeerAudio({
  stream, volume, muted,
}: {
  stream: MediaStream | null
  /** 0-200, per-peer local volume. 100 = normal, 200 = 2x. */
  volume: number
  /** Local mute -- does not affect what the peer is sending. */
  muted: boolean
}) {
  const ref = useRef<HTMLAudioElement | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    if (!stream) return
    const audio = ref.current ?? new Audio()
    ref.current = audio
    audio.autoplay = true
    audio.volume = 1 // We control volume via GainNode
    audio.srcObject = stream
    audio.play().catch(() => {
      // Autoplay can be refused until the page has a user gesture;
      // joining a call is one, so this is rare and self-correcting.
    })

    // Create a GainNode for 0-200% volume range
    const ctx = new AudioContext()
    ctxRef.current = ctx
    const source = ctx.createMediaStreamSource(stream)
    const gain = ctx.createGain()
    gain.gain.value = muted ? 0 : volume / 100
    source.connect(gain)
    gain.connect(ctx.destination)
    gainRef.current = gain

    return () => {
      audio.pause()
      audio.srcObject = null
      source.disconnect()
      gain.disconnect()
      ctx.close()
    }
  }, [stream])

  useEffect(() => {
    if (gainRef.current) {
      gainRef.current.gain.value = muted ? 0 : volume / 100
    }
  }, [volume, muted])

  return null
}
