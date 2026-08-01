import { useState, useRef, useCallback, useEffect } from 'react'
import { } from '@/components/icons'
import ParticipantTile from './ParticipantTile'
import PeerAudio from './PeerAudio'
import VoiceRoomCollapsedBar from './VoiceRoomCollapsedBar'

import { useVoiceRoom } from '../../voice/useVoiceRoom'
import { useAudioLevel } from '../../hooks/useAudioLevel'
import { getOrCreateAudioContext, resumeAudioContext } from '../../voice/audioContext'
import { voiceError } from '../../voice/log'
import type { ChannelState } from '../../lib/chat/domain/types'

interface PeerState {
  id: number
  displayName: string
  stream: MediaStream | null
  speaking: boolean
}

interface VoiceRoomViewProps {
  channel: ChannelState
  /** Chat websocket state. A reconnect drops us from the room server-side. */
  wsConnected?: boolean
  /** Reading another channel: render the compact bottom bar, stay mounted. */
  collapsed?: boolean
  /** Jump back to the voice channel from the collapsed bar. */
  onExpand?: () => void
  myUserId: number | null
  myRole: string | null
  nick: string
  nickMap: Map<number, string>
  sendViaWs: (msg: object) => void
  onVoiceMessage: (handler: (type: string, data: any) => void) => () => void
  onLeave: () => void
  /** Non-null when the radio MiniPlayer is visible. The voice bar
   *  should sit above it instead of covering it. */
  radioCurrent?: unknown
}

const VAD_THRESHOLD_DEFAULT = 0.025

export default function VoiceRoomView({
  channel, wsConnected = true, collapsed = false, onExpand, myUserId, myRole, nick, nickMap,
  sendViaWs, onVoiceMessage, onLeave, radioCurrent,
}: VoiceRoomViewProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)

  const [pttActive, setPttActive] = useState(false)
  const [vadOn, setVadOn] = useState(false)
  const [vadThreshold, setVadThreshold] = useState(VAD_THRESHOLD_DEFAULT)
  const [micReady, setMicReady] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const [vadStream, setVadStream] = useState<MediaStream | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const gateRef = useRef<GainNode | null>(null)

  const level = useAudioLevel(vadStream)
  const vadHoldRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const vadOpenRef = useRef(false)
  const [vadOpen, setVadOpen] = useState(false)
  const micEnabled = pttActive || vadOpen

  // Sync ref with state so the effect always reads the latest value
  // without depending on `vadOpen` in deps (which would cause re-render loops).
  vadOpenRef.current = vadOpen

  // ponytail: VAD with hold timer. When the level drops below threshold,
  // we wait 400ms before closing. This prevents the mic from cutting off
  // between syllables or brief pauses in speech.
  //
  // IMPORTANT: no cleanup function that clears the timeout — `level`
  // changes every animation frame via rAF, so the effect re-runs
  // constantly and the cleanup would cancel the hold timer before it
  // fires. The timeout is managed entirely inside the effect body.
  useEffect(() => {
    if (!vadOn || pttActive) {
      if (vadHoldRef.current) {
        clearTimeout(vadHoldRef.current)
        vadHoldRef.current = null
      }
      setVadOpen(false)
      return
    }
    if (level >= vadThreshold) {
      // Speaking — open immediately, cancel any pending close
      if (vadHoldRef.current) {
        clearTimeout(vadHoldRef.current)
        vadHoldRef.current = null
      }
      if (!vadOpenRef.current) setVadOpen(true)
    } else if (vadOpenRef.current) {
      // Silence detected but we hold for 400ms before closing
      if (!vadHoldRef.current) {
        vadHoldRef.current = setTimeout(() => {
          vadHoldRef.current = null
          setVadOpen(false)
        }, 400)
      }
    }
  }, [level, vadThreshold, vadOn, pttActive])

  const voiceRoom = useVoiceRoom(sendViaWs, localStream, onVoiceMessage)

  const peerVolumes = useRef<Map<number, number>>(new Map())

  // ponytail: do not announce ourselves until the mic has resolved.
  //
  // joinRoom used to fire on mount, in the effect above getUserMedia's,
  // so the roster came back first and every peer was built with zero
  // tracks. When the mic finally landed, addLocalStream had to
  // re-negotiate from `stable`, which cannot produce an answer, and the
  // rejection was swallowed by a debug recorder that is a no-op without
  // ?voiceDebug=1 — so everyone already in the room heard nothing from
  // the joiner, silently, forever.
  //
  // micError still joins: no microphone is a valid way to sit in a call
  // and listen.
  //
  // wsConnected is in the deps because the server drops us from the room
  // whenever our socket closes (routers/ws.py runs voice_rooms.leave in
  // its finally block, unconditionally). Without re-announcing on
  // reconnect the client keeps showing a call the server thinks ended:
  // the other side stops seeing you and never gets your peer_joined.
  // voice_rooms.join is idempotent, so re-sending is free.
  useEffect(() => {
    if (!micReady && !micError) return
    if (!wsConnected) return
    voiceRoom.joinRoom(String(channel.id))
    return () => voiceRoom.leaveRoom(String(channel.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id, micReady, micError, wsConnected])

  useEffect(() => {
    let cancelled = false
    setMicError(null)
    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    }
      navigator.mediaDevices.getUserMedia(constraints)
      .then(async stream => {
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        const liveTrack = stream.getAudioTracks()[0]
        const vadTrack = liveTrack?.clone() ?? null
        if (vadTrack) {
          vadTrack.enabled = true
          setVadStream(new MediaStream([vadTrack]))
        }

        // ponytail: send the raw stream to the peer. The browser's
        // built-in echo cancellation / noise suppression / AGC (from
        // the getUserMedia constraints) is enough. The earlier custom
        // DSP chain (highpass + lowpass + compressor + gain 1.4) was
        // amplifying ambient noise + the headless test tone into a
        // white-noise hash on the receiving end. If a custom chain
        // is needed later, gate it behind a flag and verify on real
        // audio, don't ship an untuned one.
        //
        // We DO wrap the stream in a Web Audio graph with a single
        // GainNode so PTT / VAD can mute the audio by setting
        // gain=0 instead of toggling track.enabled. Disabling the
        // track stops the browser from sending RTP, which lets the
        // NAT mapping die after ~30s of silence — that's why the
        // remote stopped hearing the user after the first sentence.
        // With this gate, packets still flow (silence frames) and
        // the connection stays alive.

        let processed: MediaStream | null = null
        // ponytail: reuse the AudioContext that IrcPage created inside
        // the click handler. Creating a fresh `new AudioContext()` here
        // is too late on iOS Safari — the user gesture has already
        // unwound, the context stays suspended, and
        // MediaStreamAudioDestinationNode emits silent tracks.
        const audioCtx = getOrCreateAudioContext()
        await resumeAudioContext()
        const source = audioCtx.createMediaStreamSource(stream)
        const gate = audioCtx.createGain()
        gate.gain.value = 1
        const dest = audioCtx.createMediaStreamDestination()
        source.connect(gate)
        gate.connect(dest)
        processed = dest.stream
        gateRef.current = gate

        micStreamRef.current = stream
        setLocalStream(processed)
        setMicReady(true)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        // The DOMException name is the only thing that distinguishes
        // "you said no" from "there is no microphone" from "something
        // else already has it", and they need different actions from
        // the user. Swallowing it produced one useless message for all
        // three.
        const name = (err as DOMException)?.name
        voiceError('getUserMedia failed', { name, err })
        setMicError(
          name === 'NotAllowedError' || name === 'SecurityError'
            ? 'Bloqueaste el micrófono. Habilitalo en el candado de la barra de direcciones y recargá.'
            : name === 'NotFoundError' || name === 'OverconstrainedError'
            ? 'No encontramos ningún micrófono conectado.'
            : name === 'NotReadableError'
            ? 'Otra aplicación está usando el micrófono. Cerrala y volvé a entrar.'
            : 'No se pudo acceder al micrófono.',
        )
      })
    return () => {
      cancelled = true
      micStreamRef.current?.getTracks().forEach(t => t.stop())
      micStreamRef.current = null
      // Disconnect our nodes but do NOT close the context: it is the
      // module-level singleton from audioContext.ts, shared with every
      // later join and with the spectrum analysers. Closing it here
      // made the second join of a page session throw InvalidStateError
      // out of createMediaStreamSource, before micStreamRef was set,
      // so that join's mic tracks leaked too. A closed AudioContext
      // cannot be reopened.
      if (gateRef.current) {
        gateRef.current.disconnect()
        gateRef.current = null
      }
      vadStream?.getTracks().forEach(t => t.stop())
      setVadStream(null)
    }
  }, [])

  // ponytail: keep the mic track enabled and the audio always
  // flowing. Disabling the track on PTT release / VAD close stopped
  // the browser from sending RTP, which let the NAT mapping die
  // after ~30s of silence. Mute via the Web Audio gain instead so
  // silence frames (DTX) keep the connection alive.
  useEffect(() => {
    const gate = gateRef.current
    if (!gate) return
    // Smooth ramp avoids clicks; ~30ms is inaudible.
    const now = gate.context.currentTime
    gate.gain.cancelScheduledValues(now)
    gate.gain.setValueAtTime(gate.gain.value, now)
    gate.gain.linearRampToValueAtTime(micEnabled ? 1 : 0, now + 0.03)
  }, [micEnabled])

  const pttPress = useCallback(() => {
    if (!micReady) return
    setPttActive(true)
  }, [micReady])
  const pttRelease = useCallback(() => setPttActive(false), [])

  // Space-to-talk only while the room is on screen. The component now
  // stays mounted for the whole call, so an unguarded global handler
  // meant that reading a text channel and pressing Space to scroll
  // opened your mic and swallowed the scroll. Typing was already safe
  // (inputs are skipped); browsing was not. Use the hold button in the
  // bar when you are somewhere else.
  useEffect(() => {
    if (!micReady || collapsed) return
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return
      // Don't capture Space when typing in an input, textarea, or
      // contenteditable — the user is writing a message, not PTT.
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      e.preventDefault()
      pttPress()
    }
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      pttRelease()
    }
    const blur = () => pttRelease()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [micReady, collapsed, pttPress, pttRelease])

  const peers: PeerState[] = voiceRoom.peers
  const totalConnected = peers.length + (micReady ? 1 : 0)

  const handleKick = useCallback((targetUserId: number) => {
    sendViaWs({
      type: 'voice.peer_kick',
      target_user_id: targetUserId,
      channel_id: channel.id,
    })
  }, [sendViaWs, channel.id])

  const isAdmin = myRole === 'admin'

  // ponytail: collapsed = you are reading another channel while the call
  // runs. We must NOT unmount — the effect cleanup above hangs up — so we
  // render a compact bar into a portal on <body> instead. Fixed to the
  // bottom, taking the surface the radio's MiniPlayer would occupy;
  // handleVoiceJoin stops the radio so the two never fight over it.
  // Audio sinks for every peer. Rendered in both the expanded and the
  // collapsed branch, because playback must not depend on the tiles.
  const peerAudio = peers.map(p => (
    <PeerAudio
      key={p.id}
      stream={p.stream}
      volume={peerVolumes.current.get(p.id) ?? 100}
      muted={false}
    />
  ))

  // ponytail: the bar is up for the whole call, in both states. The main
  // pane is the only thing that swaps -- participant grid, or the text
  // channel you opened. Controls live only in the bar so they never move
  // under you when you change channel.
  if (collapsed) {
    return (
      <>
        {peerAudio}
      <VoiceRoomCollapsedBar
        roomName={channel.name.replace(/^🔊\s*/, '')}
        names={[nick, ...peers.map(p => nickMap.get(p.id) ?? p.displayName)]}
        totalConnected={totalConnected}
        micReady={micReady}
        micEnabled={micEnabled}
        micError={micError}
        onPttDown={pttPress}
        onPttUp={pttRelease}
        vadOn={vadOn}
        onVadChange={setVadOn}
        showingRoom={!collapsed}
        onExpand={() => onExpand?.()}
        onLeave={onLeave}
        radioActive={!!radioCurrent}
      />
      </>
    )
  }

  return (
    <>
      <VoiceRoomCollapsedBar
        roomName={channel.name.replace(/^🔊\s*/, '')}
        names={[nick, ...peers.map(p => nickMap.get(p.id) ?? p.displayName)]}
        totalConnected={totalConnected}
        micReady={micReady}
        micEnabled={micEnabled}
        micError={micError}
        onPttDown={pttPress}
        onPttUp={pttRelease}
        vadOn={vadOn}
        onVadChange={setVadOn}
        showingRoom={!collapsed}
        onExpand={() => onExpand?.()}
        onLeave={onLeave}
        radioActive={!!radioCurrent}
      />
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950">
      {peerAudio}
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5  ">
        <div className="flex items-center gap-2">
          <span className="text-base">🔊</span>
          <span className="text-sm font-semibold text-slate-100">
            {channel.name.replace(/^🔊\s*/, '')}
          </span>
          <span className="text-xs text-slate-500">
            {totalConnected} conectado{totalConnected !== 1 ? 's' : ''}
          </span>
        </div>

      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left column: participants + PTT */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {/* Self tile */}
            <ParticipantTile
              displayName={nick}
              stream={localStream}
              isSelf
              micOn={micEnabled}
              speaking={micEnabled && voiceRoom.peers.length > 0}
              isAdmin={false}
              volume={100}
              onVolumeChange={() => {}}
            />
            {/* Peer tiles */}
            {peers.map(p => {
              const vol = peerVolumes.current.get(p.id) ?? 100
              return (
                <ParticipantTile
                  key={p.id}
                  displayName={nickMap.get(p.id) ?? p.displayName}
                  stream={p.stream}
                  isSelf={false}
                  micOn
                  speaking={p.speaking}
                  isAdmin={isAdmin}
                  volume={vol}
                  onVolumeChange={(v) => {
                    peerVolumes.current.set(p.id, v)
                    sendViaWs({ type: 'voice.peer_volume', to: p.id, volume: v })
                  }}
                  onKick={isAdmin ? () => handleKick(p.id) : undefined}
                />
              )
            })}
          </div>
          {/* Controls live in the bottom bar, not here. */}
        </div>


      </div>
      {/* PTT hint at the bottom of the voice room */}
      {!micError && micReady && (
        <div className="text-center py-2 border-t border-white/5">
          <span className="text-[10px] text-slate-500">
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-mono text-[10px]">ESPACIO</kbd> para hablar (Push to Talk)
          </span>
        </div>
      )}
    </div>
    </>
  )
}

