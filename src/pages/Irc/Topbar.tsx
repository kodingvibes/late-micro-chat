import { Hash, Users, Menu, Pencil } from '@/components/icons'
import type { ChannelState } from '@/lib/chat/domain/types'

interface TopbarProps {
  currentChan: ChannelState | undefined
  // ponytail: the appshell shows the live count badge on the
  // Chat nav link, so the MF's own Topbar only needs a button
  // to open the user list — no count attached.
  showUsersDrawer: boolean
  onToggleUsers: () => void
  onOpenChannels: () => void
  onEditTopic: () => void
  canEditTopic: boolean
}

export function Topbar({
  currentChan,
  showUsersDrawer,
  onToggleUsers,
  onOpenChannels,
  onEditTopic,
  canEditTopic,
}: TopbarProps) {
  return (
    <div className="flex-shrink-0 bg-slate-900/60 px-3 sm:px-4 h-10 flex items-center justify-between z-20">
      {/* ponytail: hamburger toggles the channels drawer on mobile.
          On desktop the drawer is unnecessary (the channels list
          already lives in the left rail), so the button is hidden
          past the sm breakpoint. */}
      <button
        onClick={onOpenChannels}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors sm:hidden"
        aria-label="Abrir canales"
      >
        <Menu className="w-5 h-5" />
      </button>
      <div className="flex items-center gap-1.5 min-w-0 flex-1 sm:flex-initial sm:justify-start">
        <Hash className="w-4 h-4 text-slate-500 flex-shrink-0" />
        <h1 className="font-semibold text-slate-100 text-sm sm:text-base truncate">
          {currentChan?.name?.slice(1) || 'chat'}
        </h1>
        {/* ponytail: channel topic/description shows on desktop
            (where there's room) and hides on mobile, where the
            header is already tight. The edit pencil follows the
            same visibility rule so the editor button doesn't
            dangle without its label. */}
        {currentChan?.description && (
          <span className="text-xs text-slate-500 truncate max-w-[280px] hidden lg:inline">
            · {currentChan.description}
          </span>
        )}
        {canEditTopic && (
          <button
            type="button"
            onClick={onEditTopic}
            className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors flex-shrink-0 hidden lg:inline-flex"
            aria-label="Editar descripción del canal"
            title="Editar descripción del canal"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <button
        onClick={onToggleUsers}
        className={`p-1.5 rounded-lg transition-colors ${
          showUsersDrawer
            ? 'bg-accent/15 text-accent'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
        }`}
        aria-label="Ver usuarios"
        title="Usuarios en línea en este canal"
      >
        <Users className="w-4 h-4" />
      </button>
    </div>
  )
}
