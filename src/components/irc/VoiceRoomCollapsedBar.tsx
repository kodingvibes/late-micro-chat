import { createPortal } from 'react-dom'
import { Mic, MicOff, PhoneOff } from '@/components/icons'
import Avatar from './Avatar'

/**
 * The voice call, collapsed into the bottom bar while you read another
 * channel.
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
  onToggleMic: () => void
  onExpand: () => void
  onLeave: () => void
}

const MAX_AVATARS = 4

export default function VoiceRoomCollapsedBar({
  roomName, names, totalConnected,
  micReady, micEnabled, onToggleMic, onExpand, onLeave,
}: VoiceRoomCollapsedBarProps) {
  return createPortal(
    <div
      className="fixed bottom-0 left-0 right-0 z-50 h-14 bg-surface-3 backdrop-blur shadow-2xl flex items-center gap-2 sm:gap-3 px-2 sm:px-4 animate-slide-in-from-bottom"
      role="region"
      aria-label="Llamada de voz en curso"
    >
      <button
        onClick={onExpand}
        className="flex items-center gap-2 min-w-0 flex-1 text-left hover:opacity-80 transition-opacity"
        title="Volver a la sala de voz"
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

      <button
        onClick={onToggleMic}
        disabled={!micReady}
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-40 ${
          micEnabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-surface-2 text-slate-300 hover:bg-surface-1'
        }`}
        aria-label={micEnabled ? 'Silenciar micrófono' : 'Activar micrófono'}
        title={micReady ? (micEnabled ? 'Silenciar' : 'Hablar') : 'Sin micrófono'}
      >
        {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
      </button>

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
