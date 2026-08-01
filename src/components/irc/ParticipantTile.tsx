import { useEffect, useState } from 'react'
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
  onVolumeChange: (vol: number) => void
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
  volume,
  onVolumeChange, onKick,
  onMicToggle, onAmountChange, amount, onRecord, recording,
}: ParticipantTileProps) {
  const [showVolume, setShowVolume] = useState(false)
  const level = useAudioLevel(isSelf ? (micOn ? stream : null) : (speaking ? stream : null))

  // ponytail: playback moved to PeerAudio, rendered by VoiceRoomView.
  // It used to live here, which tied hearing someone to their tile being
  // on screen -- so collapsing the call into the bottom bar unmounted the
  // tiles and silenced everyone while the connection stayed up. This
  // component now only draws the participant.

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
      className={`relative flex flex-col items-center gap-2 rounded-2xl p-4 transition-all duration-200 ${
        speaking
          ? 'bg-white/10 backdrop-blur-lg shadow-lg shadow-emerald-500/10'
          : 'bg-white/[0.06] backdrop-blur-md'
      }`}
    >
      {/* Avatar */}
      <div className="relative">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white select-none transition-all duration-200 ${
            speaking ? 'shadow-xl shadow-emerald-400/30 scale-105' : 'shadow-lg shadow-black/20'
          }`}
          style={{ backgroundColor: getNickColor(displayName) }}
          title={displayName}
        >
          {initial}
        </div>
        {/* Speaking indicator */}
        {micOn && speaking && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-0.5">
            {Array.from({ length: 4 }).map((_, i) => (
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
      </div>

      {/* Name */}
      <div className="flex flex-col items-center min-w-0 max-w-full">
        <span className="text-xs font-semibold text-slate-100 truncate max-w-[90px]">
          {displayName}
        </span>
      </div>

      {/* Spectrum analyzer */}
      <SpectrumAnalyzer
        stream={micOn || !isSelf ? stream : null}
        active={micOn || !isSelf}
        barCount={12}
        className="w-full max-w-[80px]"
      />

      {/* Self controls */}
      {isSelf && (
        <div className="flex items-center justify-center gap-2 w-full mt-1">
          {onMicToggle && (
            <button
              onClick={onMicToggle}
              className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
                micOn ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-slate-200 hover:bg-white/10'
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
                recording ? 'bg-red-500/20 text-red-300 animate-pulse' : 'text-slate-400 hover:text-slate-200 hover:bg-white/10'
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
        <div className="flex items-center justify-center gap-2 w-full mt-1">
          {/* Volume control */}
          <div className="relative">
            <button
              onClick={() => setShowVolume(true)}
              onMouseEnter={() => setShowVolume(true)}
              onMouseLeave={() => {
                // Don't close here — the popup's onMouseLeave handles it
              }}
              className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors"
              title="Ajustar volumen"
            >
              <Volume2 className="w-3.5 h-3.5" />
            </button>
            {showVolume && (
              <div
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-800/90 backdrop-blur-xl rounded-xl p-3 shadow-2xl z-50 flex flex-col items-center gap-1.5 animate-menu-tooltip border border-white/10"
                onMouseEnter={() => setShowVolume(true)}
                onMouseLeave={() => setShowVolume(false)}
              >
                <span className="text-[10px] font-medium text-slate-400">Volumen</span>
                <input
                  type="range"
                  min="0" max="200"
                  value={volume}
                  onChange={e => onVolumeChange(Number(e.target.value))}
                  className="w-20 h-1 accent-accent"
                />
                <span className="text-[10px] font-medium text-slate-300 tabular-nums">{volume}%</span>
              </div>
            )}
          </div>

          {/* Kick (admin only) */}
          {isAdmin && onKick && (
            <button
              onClick={onKick}
              className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
              title="Expulsar del canal de voz"
            >
              <ShieldX className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
