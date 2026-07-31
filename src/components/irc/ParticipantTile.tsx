import { useRef, useEffect, useState } from 'react'
import { Mic, MicOff, Volume2, VolumeX, ShieldX } from '@/components/icons'
import { useAudioLevel } from '../../hooks/useAudioLevel'
import { getNickColor } from '../../lib/irc/colors'
import SpectrumAnalyzer from './SpectrumAnalyzer'

interface ParticipantTileProps {
  displayName: string
  stream: MediaStream | null
  isSelf: boolean
  micOn: boolean
  speaking: boolean
  isAdmin: boolean
  volume: number
  locallyMuted: boolean
  onVolumeChange: (vol: number) => void
  onLocalMuteToggle: () => void
  onKick?: () => void
  onMicToggle?: () => void
  onAmountChange?: (amount: number) => void
  amount?: number
  onRecord?: () => void
  recording?: boolean
}

export default function ParticipantTile({
  displayName, stream, isSelf,
  micOn, speaking, isAdmin,
  volume, locallyMuted,
  onVolumeChange, onLocalMuteToggle, onKick,
  onMicToggle, onAmountChange, amount, onRecord, recording,
}: ParticipantTileProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [showVolume, setShowVolume] = useState(false)
  const level = useAudioLevel(isSelf ? (micOn ? stream : null) : (speaking ? stream : null))

  useEffect(() => {
    if (!stream || isSelf) {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.srcObject = null
        audioRef.current = null
      }
      return
    }
    if (!audioRef.current) {
      const audio = new Audio()
      audio.autoplay = true
      audioRef.current = audio
    }
    audioRef.current.srcObject = stream
    audioRef.current.play().catch(() => {})
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.srcObject = null
      }
    }
  }, [stream, isSelf])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = locallyMuted ? 0 : (volume / 100)
    }
  }, [volume, locallyMuted])

  // ponytail: the tile used to fetch initials from ui-avatars.com. That
  // service's renderer is currently failing: any request that misses the
  // CDN cache comes back as a PHP fatal error with `content-type:
  // image/png` and an HTML body, so the <img> can't decode it. Only names
  // already warm in Cloudflare still resolve, which is worse than a clean
  // outage - some participants got an avatar and the rest fell through to
  // the fallback, and which is which depends on a third party's cache.
  // Measured, not assumed: every cache MISS failed regardless of params
  // (`background` is not the trigger); HITs returned a valid SVG.
  //
  // The fallback also double-rendered: `{imgError ? initial : <img>}`
  // followed by `{imgError && <span>{initial}</span>}` painted the letter
  // twice, which is the "VV" / "RR" people were seeing. Drawing the
  // initial ourselves drops the third party, the leak of every
  // participant's display name to it, and that bug in one go.
  //
  // Colour comes from the shared getNickColor so a user is the same
  // colour here as in the user list, the message list and the member
  // modal. The old `hsl(userId * 37)` gave the same person a different
  // colour in voice than everywhere else.
  const initial = displayName.charAt(0).toUpperCase() || '?'

  return (
    <div
      className={`relative flex flex-col items-center gap-2 rounded-xl p-3 transition-all duration-150 ${
        speaking && !locallyMuted
          ? 'bg-emerald-500/10 ring-2 ring-emerald-400/60'
          : 'bg-surface-2 ring-1 '
      }`}
    >
      {/* Avatar */}
      <div className="relative">
        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-white select-none transition-shadow ${
            speaking && !locallyMuted ? 'shadow-lg shadow-emerald-400/20' : ''
          }`}
          style={{ backgroundColor: getNickColor(displayName) }}
          title={displayName}
        >
          {initial}
        </div>
        {/* Speaking indicator */}
        {!locallyMuted && (
          <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 flex items-center gap-0.5">
            {micOn && speaking && Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="w-1 bg-emerald-400 rounded-full animate-pulse"
                style={{
                  height: `${4 + level * 16 * (0.5 + i * 0.25)}px`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        )}
        {/* Mute badge */}
        {locallyMuted && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center">
            <VolumeX className="w-3 h-3 text-white" />
          </div>
        )}
      </div>

      {/* Spectrum analyzer */}
      <SpectrumAnalyzer
        stream={micOn || !isSelf ? stream : null}
        active={micOn || !isSelf}
        barCount={12}
        className="w-full max-w-[80px]"
      />

      {/* Name */}
      <div className="flex flex-col items-center min-w-0 max-w-full">
        <span className="text-xs font-medium text-slate-200 truncate max-w-[90px]">
          {displayName}
        </span>
      </div>

      {/* Self controls */}
      {isSelf && (
        <div className="flex flex-col items-center gap-1.5 w-full mt-1">
          {onMicToggle && (
            <button
              onClick={onMicToggle}
              className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
                micOn ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-slate-200 hover:bg-surface-2'
              }`}
              title={micOn ? 'Silenciar micrófono' : 'Activar micrófono'}
            >
              {micOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
            </button>
          )}
          {onAmountChange && amount !== undefined && (
            <div className="flex items-center gap-1.5 w-full px-1">
              <label className="text-[8px] text-slate-500 whitespace-nowrap">Amount</label>
              <input
                type="range"
                min="0" max="100"
                value={amount}
                onChange={e => onAmountChange(Number(e.target.value))}
                className="w-full h-1 accent-accent"
              />
              <span className="text-[9px] text-slate-500 tabular-nums w-4 text-right">{amount}</span>
            </div>
          )}
          {onRecord && (
            <button
              onMouseDown={onRecord}
              disabled={recording}
              className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
                recording ? 'bg-red-500/20 text-red-300 animate-pulse' : 'text-slate-400 hover:text-slate-200 hover:bg-surface-2'
              }`}
              title={recording ? 'Grabando...' : 'Mantener para nota de voz'}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="6" />
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Peer controls */}
      {!isSelf && (
        <div className="flex items-center gap-1 mt-1">
          {/* Volume control */}
          <div
            className="relative"
            onMouseEnter={() => setShowVolume(true)}
            onMouseLeave={() => setShowVolume(false)}
          >
            <button
              onClick={() => {
                if (locallyMuted) onLocalMuteToggle()
                else setShowVolume(!showVolume)
              }}
              className={`flex items-center justify-center w-6 h-6 rounded-md transition-colors ${
                locallyMuted ? 'text-rose-400 bg-rose-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-surface-2'
              }`}
              title={locallyMuted ? 'Activar audio' : 'Ajustar volumen'}
            >
              {locallyMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
            </button>
            {showVolume && !locallyMuted && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-surface-2  rounded-lg p-2 shadow-xl z-50 flex flex-col items-center gap-1 animate-menu-tooltip">
                <span className="text-[8px] text-slate-500">Vol.</span>
                <input
                  type="range"
                  min="0" max="100"
                  value={volume}
                  onChange={e => onVolumeChange(Number(e.target.value))}
                  className="w-16 h-1 accent-accent rotate-0"
                  style={{ writingMode: 'horizontal-tb' }}
                />
                <span className="text-[9px] text-slate-500 tabular-nums">{volume}</span>
              </div>
            )}
          </div>

          {/* Local mute toggle */}
          <button
            onClick={onLocalMuteToggle}
            className={`flex items-center justify-center w-6 h-6 rounded-md transition-colors ${
              locallyMuted ? 'text-rose-400 bg-rose-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-surface-2'
            }`}
            title={locallyMuted ? 'Reactivar audio' : 'Silenciar localmente'}
          >
            {locallyMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
          </button>

          {/* Kick (admin only) */}
          {isAdmin && onKick && (
            <button
              onClick={onKick}
              className="flex items-center justify-center w-6 h-6 rounded-md text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
              title="Expulsar del canal de voz"
            >
              <ShieldX className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
