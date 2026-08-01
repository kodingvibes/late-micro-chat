import { createPortal } from 'react-dom'
import { Mic, MicOff, PhoneOff, Activity } from '@/components/icons'
import Avatar from './Avatar'

/**
 * The voice call's controls, always docked at the bottom while a call is
 * up -- whether you are looking at the participant grid or reading a
 * text channel. Push-to-talk, voice activation and hang-up live here and
 * only here, so the main pane is free to be the grid or the channel and
 * the controls never move under you.
 *
 * Portaled onto <body> and fixed to the bottom, on the same surface the
 * radio's MiniPlayer uses -- joining a voice channel stops the radio, so
 * only one of the two is ever up. The chat layout reserves the matching
 * 56px (`pb-14` in IrcPage), so this must stay h-14 or it covers the
 * message composer.
 *
 * Presentational on purpose: VoiceRoomView owns the call and stays
 * mounted regardless of what this renders, because unmounting it would
 * hang up.
 */
export interface VoiceRoomCollapsedBarProps {
  roomName: string
  /** Display names, self first. Rendered as an avatar stack. */
  names: string[]
  totalConnected: number
  micReady: boolean
  micEnabled: boolean
  micError: string | null
  /** Push-to-talk, held down. */
  onPttDown: () => void
  onPttUp: () => void
  vadOn: boolean
  onVadChange: (on: boolean) => void
  /** True when the grid is already on screen, so the name is not a link. */
  showingRoom: boolean
  onExpand: () => void
  onLeave: () => void
}

const MAX_AVATARS = 4

export default function VoiceRoomCollapsedBar({
  roomName, names, totalConnected,
  micReady, micEnabled, micError, onPttDown, onPttUp,
  vadOn, onVadChange, showingRoom, onExpand, onLeave,
}: VoiceRoomCollapsedBarProps) {
  return createPortal(
    <div
      className="fixed bottom-0 left-0 right-0 z-50 h-14 bg-surface-3 backdrop-blur shadow-2xl flex items-center gap-2 sm:gap-3 px-2 sm:px-4 animate-slide-in-from-bottom"
      role="region"
      aria-label="Llamada de voz en curso"
    >
      <button
        onClick={onExpand}
        disabled={showingRoom}
        className="flex items-center gap-2 min-w-0 flex-1 text-left transition-opacity enabled:hover:opacity-80 disabled:cursor-default"
        title={showingRoom ? undefined : 'Volver a la sala de voz'}
      >
        <span className="text-base flex-shrink-0">🔊</span>
        <span className="flex flex-col min-w-0 leading-tight">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
            En llamada
          </span>
          <span className="text-sm font-medium text-slate-100 truncate">{roomName}</span>
        </span>
        {/* Same Avatar + overflow stack ChannelList uses on voice rows, so
            a person is the same colour here as everywhere else. */}
        <span className="flex items-center -space-x-2 flex-shrink-0 ml-1">
          {names.slice(0, MAX_AVATARS).map((name, i) => (
            <Avatar key={i} nick={name} size="sm" />
          ))}
          {totalConnected > MAX_AVATARS && (
            <span className="w-7 h-7 rounded-lg bg-surface-2 flex items-center justify-center text-[10px] font-semibold text-slate-300 flex-shrink-0">
              +{totalConnected - MAX_AVATARS}
            </span>
          )}
        </span>
      </button>

      {micError ? (
        <span className="text-[11px] text-rose-400 truncate max-w-[9rem] sm:max-w-xs flex-shrink" title={micError}>
          {micError}
        </span>
      ) : (
        <>
          {/* Hold to talk. Same gesture as the old in-pane button, just
              somewhere that does not disappear when you open a channel. */}
          <button
            onMouseDown={onPttDown}
            onMouseUp={onPttUp}
            onMouseLeave={onPttUp}
            onTouchStart={(e) => { e.preventDefault(); onPttDown() }}
            onTouchEnd={(e) => { e.preventDefault(); onPttUp() }}
            disabled={!micReady}
            className={`flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-semibold flex-shrink-0 select-none transition-all disabled:opacity-40 ${
              micEnabled
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                : 'bg-surface-2 text-slate-200 hover:bg-surface-1 active:scale-95'
            }`}
            title={micReady ? 'Mantené presionado o Space para hablar' : 'Sin micrófono'}
          >
            {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            <span className="hidden md:inline">{micEnabled ? 'Hablando…' : 'Hablar'}</span>
          </button>

          <label
            className={`items-center gap-1.5 text-[11px] cursor-pointer select-none flex-shrink-0 hidden sm:flex ${
              micReady ? 'text-slate-400' : 'text-slate-600 cursor-not-allowed'
            }`}
            title="Auto-detectar voz"
          >
            <input
              type="checkbox"
              checked={vadOn}
              disabled={!micReady}
              onChange={e => onVadChange(e.target.checked)}
              className="accent-accent"
            />
            <Activity className="w-3 h-3" />
            <span className="hidden lg:inline">Auto</span>
          </label>
        </>
      )}

      <button
        onClick={onLeave}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 transition-colors flex-shrink-0"
        aria-label="Salir de la sala de voz"
      >
        <PhoneOff className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Salir</span>
      </button>
    </div>,
    document.body,
  )
}
