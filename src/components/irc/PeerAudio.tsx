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
  /** 0-100, per-peer local volume. */
  volume: number
  /** Local mute -- does not affect what the peer is sending. */
  muted: boolean
}) {
  const ref = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!stream) return
    const audio = ref.current ?? new Audio()
    ref.current = audio
    audio.autoplay = true
    audio.srcObject = stream
    audio.play().catch(() => {
      // Autoplay can be refused until the page has a user gesture;
      // joining a call is one, so this is rare and self-correcting.
    })
    return () => {
      audio.pause()
      audio.srcObject = null
    }
  }, [stream])

  useEffect(() => {
    if (ref.current) ref.current.volume = muted ? 0 : volume / 100
  }, [volume, muted])

  return null
}
