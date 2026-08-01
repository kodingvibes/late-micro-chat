import { createPortal } from 'react-dom'
import { Mic, MicOff, PhoneOff, Activity } from '@/components/icons'

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  ariaLabel,
  color = 'emerald',
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  ariaLabel: string
  color?: 'emerald' | 'accent'
}) {
  const colorClass = color === 'emerald' ? 'bg-emerald-500' : 'bg-indigo-500'
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
        checked ? colorClass : 'bg-slate-600'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  )
}
export interface VoiceRoomCollapsedBarProps {
  roomName: string
  names: string[]
  totalConnected: number
  micReady: boolean
  micEnabled: boolean
  micError: string | null
  onPttDown: () => void
  onPttUp: () => void
  vadOn: boolean
  onVadChange: (on: boolean) => void
  autoThreshold: boolean
  onAutoThresholdChange: (on: boolean) => void
  showingRoom: boolean
  onExpand: () => void
  onLeave: () => void
  /** When true, the radio MiniPlayer is visible below — voice bar sits above it. */
  radioActive?: boolean
}

const MAX_AVATARS = 3

export default function VoiceRoomCollapsedBar({
  roomName, names, totalConnected,
  micReady, micEnabled, micError, onPttDown, onPttUp,
  vadOn, onVadChange, autoThreshold, onAutoThresholdChange,
  showingRoom, onExpand, onLeave, radioActive,
}: VoiceRoomCollapsedBarProps) {
  return createPortal(
    <div
      className={`fixed left-0 right-0 z-50 h-14 bg-surface-3 backdrop-blur shadow-2xl flex items-center gap-1 sm:gap-2 px-2 sm:px-3 animate-slide-in-from-bottom ${
        radioActive ? 'bottom-14' : 'bottom-0'
      }`}
      role="region"
      aria-label="Llamada de voz en curso"
    >
      {/* Left: room info — compact */}
      <button
        onClick={onExpand}
        disabled={showingRoom}
        className="flex items-center gap-1.5 min-w-0 max-w-[100px] sm:max-w-[160px] text-left transition-opacity enabled:hover:opacity-80 disabled:cursor-default flex-shrink"
        title={showingRoom ? undefined : 'Volver a la sala de voz'}
      >
        <span className="text-base flex-shrink-0">🔊</span>
        <span className="flex flex-col min-w-0 leading-tight">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
            En llamada
          </span>
          <span className="text-sm font-medium text-slate-100 truncate">{roomName}</span>
        </span>
      </button>

      {micError ? (
        <span className="text-[11px] text-rose-400 truncate max-w-[9rem] sm:max-w-xs flex-shrink" title={micError}>
          {micError}
        </span>
      ) : (
        <>
          {/* Center: Big PTT button */}
          <div className="flex-1 flex items-center justify-center min-w-0">
            <button
              onMouseDown={onPttDown}
              onMouseUp={onPttUp}
              onMouseLeave={onPttUp}
              onTouchStart={(e) => { e.preventDefault(); onPttDown() }}
              onTouchEnd={(e) => { e.preventDefault(); onPttUp() }}
              // The phone takes the touch away without ever sending
              // touchend: switching apps, pressing home, an incoming
              // call, or rotating the device mid-hold all fire
              // touchcancel instead. Without this the mic stayed open
              // for the rest of the call. The window 'blur' fallback
              // does not cover it -- that effect is disabled while the
              // call is collapsed, which is exactly this bar.
              onTouchCancel={() => onPttUp()}
              disabled={!micReady}
              className={`flex items-center justify-center gap-1.5 px-5 h-10 sm:h-11 rounded-full text-xs sm:text-sm font-semibold flex-shrink-0 select-none transition-all disabled:opacity-40 min-w-[72px] sm:min-w-[100px] ${
                micEnabled
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30 scale-105'
                  : 'bg-surface-2 text-slate-200 hover:bg-surface-1 active:scale-95'
              }`}
              title={micReady ? 'Mantené presionado o Space para hablar' : 'Sin micrófono'}
            >
              {micEnabled ? <Mic className="w-4 h-4 sm:w-5 sm:h-5" /> : <MicOff className="w-4 h-4 sm:w-5 sm:h-5" />}
              <span className="hidden sm:inline">{micEnabled ? 'Hablando…' : 'Hablar'}</span>
            </button>
          </div>

          {/* Right: VAD toggles + Salir */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {/* VAD toggle switch */}
            <div className="flex items-center gap-1" title="Auto-detectar voz">
              <ToggleSwitch
                checked={vadOn}
                onChange={onVadChange}
                disabled={!micReady}
                ariaLabel="Auto-detectar voz"
              />
              <Activity className={`w-3 h-3 ${vadOn ? 'text-emerald-400' : 'text-slate-500'}`} />
            </div>

            {/* Auto-threshold toggle (solo cuando VAD está activo) */}
            {vadOn && (
              <div className="flex items-center gap-1" title="Umbral automático">
                <ToggleSwitch
                  checked={autoThreshold}
                  onChange={onAutoThresholdChange}
                  disabled={!micReady}
                  ariaLabel="Umbral automático"
                  color="accent"
                />
                <span className={`text-[10px] font-mono ${autoThreshold ? 'text-indigo-400' : 'text-slate-500'}`}>
                  A
                </span>
              </div>
            )}

            <button
              onClick={onLeave}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 transition-colors flex-shrink-0"
              aria-label="Salir de la sala de voz"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </>
      )}
    </div>,
    document.body,
  )
}
