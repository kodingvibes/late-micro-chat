interface ConnectionStatusProps {
  connected: boolean
  nick: string
  onChangeNick?: () => void
}

export default function ConnectionStatus({ connected, nick, onChangeNick }: ConnectionStatusProps) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-rose-400'} animate-pulse`} />
      <span className="text-xs text-slate-500 truncate max-w-[8rem] sm:max-w-none">
        <span className="late-chat-status-text">
          {connected ? `Conectado como ` : `Desconectado (`}
          {onChangeNick ? (
            <button
              onClick={onChangeNick}
              className="font-mono text-slate-300 hover:text-accent-soft underline-offset-2 hover:underline transition-colors"
              title="Cambiar tu nick"
            >
              {nick}
            </button>
          ) : (
            <span className="font-mono text-slate-300">{nick}</span>
          )}
          {connected ? '' : ')'}
        </span>
        <span className="sm:hidden">{nick}</span>
      </span>
    </div>
  )
}
