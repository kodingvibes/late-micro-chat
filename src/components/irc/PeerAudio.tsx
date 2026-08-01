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
 * ONE playback path, deliberately. This used to render every peer
 * twice at once: the element below AND a parallel
 * createMediaStreamSource -> GainNode -> ctx.destination graph. Both
 * reached the speaker, so the same voice was summed with itself at two
 * different latencies (doubled level, comb filtering), `muted` did
 * nothing because it only zeroed the gain while the element stayed at
 * volume 1, and the volume slider could at best halve the level.
 *
 * The element is the half that was kept, not the Web Audio one:
 *   - `.muted` is honoured on every platform; `.volume` is ignored on
 *     iOS, but Web Audio buys us nothing there either (see below).
 *   - Element output is part of the platform's echo-cancellation
 *     reference. Web Audio output is not, so routing peers through
 *     ctx.destination of the very context that captures our mic meant
 *     every remote participant could hear themselves back.
 *   - Playback no longer depends on the AudioContext being awake. iOS
 *     interrupts that context on screen lock and app switch, which
 *     would otherwise take the whole room silent with it.
 *
 * ponytail: the element is now appended to <body>. The old code kept
 * it detached to stop page CSS reaching it, but WebKit has
 * historically refused to play media elements outside the document,
 * and a controls-less <audio> is already display:none in the UA
 * stylesheet, so there is no box for CSS to reach.
 * Ceiling: per-peer volume is a no-op on iOS (hardware volume only) --
 * hence `muted` below, which every platform honours. If per-peer level
 * really is needed on iOS, the upgrade is a GainNode fed from a MUTED
 * element, never a second live output.
 */
export default function PeerAudio({
  stream, volume,
}: {
  stream: MediaStream | null
  /** 0-100, per-peer local volume. 0 mutes. */
  volume: number
}) {
  const ref = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!stream) return
    const audio = new Audio()
    audio.autoplay = true
    audio.setAttribute('playsinline', '')
    audio.srcObject = stream
    document.body.appendChild(audio)
    ref.current = audio
    audio.play().catch(() => {
      // Autoplay can be refused until the page has a user gesture;
      // joining a call is one, so this is rare and self-correcting.
    })

    return () => {
      audio.pause()
      audio.srcObject = null
      audio.remove()
      ref.current = null
    }
  }, [stream])

  useEffect(() => {
    const audio = ref.current
    if (!audio) return
    // iOS ignores .volume entirely, so dragging the slider to 0 has to
    // mute the element to actually silence the peer there.
    audio.muted = volume === 0
    audio.volume = Math.min(1, Math.max(0, volume / 100))
  }, [volume, stream])

  return null
}
