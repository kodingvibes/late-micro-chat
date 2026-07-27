import { useState, useMemo, useEffect } from 'react'
import type { ChannelState, ChannelCategory } from '../../lib/chat/domain/types'
import ChannelContextMenu, { useChannelContextMenuState } from './ChannelContextMenu'
import Avatar from './Avatar'
import { Hash, ChevronDown, ChevronRight, Plus } from '@/components/icons'
import { useLongPress } from '../../hooks/useLongPress'

interface ChannelListProps {
  channels: Map<number, ChannelState>
  categories: ChannelCategory[]
  currentChannel: string | null
  activeVoiceChannelId: number | null
  onSelect: (name: string) => void
  onVoiceJoin: (channelId: number) => void
  onVoiceLeave: (channelId: number) => void
  onCreateRequest: () => void
  onClose?: () => void
  onCopyName?: (name: string) => void
  onManageMembers?: (channelId: number) => void
  onEditTopic?: (channelId: number) => void
  onDelete?: (channelId: number) => void
}

export default function ChannelList({
  channels, categories, currentChannel, activeVoiceChannelId,
  onSelect,
  onVoiceJoin, onVoiceLeave,
  onCreateRequest, onClose, onCopyName, onManageMembers, onEditTopic, onDelete,
}: ChannelListProps) {
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const { menu: chMenu, setMenu: setChMenu, close: closeChMenu } = useChannelContextMenuState()

  // Initialize collapsed from server state
  useEffect(() => {
    setCollapsed(new Set(categories.filter(c => c.is_collapsed).map(c => c.id)))
  }, [categories])

  const filterFn = (name: string) =>
    !query.trim() || name.toLowerCase().includes(query.toLowerCase())

  // ponytail: every user belongs to every channel, so the "joined" /
  // "non-joined" split is gone. Bucket straight into category groups.
  const { categoryGroups, uncategorized } = useMemo(() => {
    const groups = new Map<number, ChannelState[]>()
    const uncat: ChannelState[] = []
    for (const c of channels.values()) {
      if (c.categoryId !== null) {
        const list = groups.get(c.categoryId) || []
        list.push(c)
        groups.set(c.categoryId, list)
      } else {
        uncat.push(c)
      }
    }
    for (const [id, list] of groups) {
      list.sort((a, b) => {
        if (a.position !== b.position) return a.position - b.position
        return a.name.localeCompare(b.name)
      })
      groups.set(id, list)
    }
    uncat.sort((a, b) => a.name.localeCompare(b.name))
    return { categoryGroups: groups, uncategorized: uncat }
  }, [channels])

  // Sort categories by position
  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => a.position - b.position)
  }, [categories])

  const toggleCollapse = (catId: number) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId)
      else next.add(catId)
      return next
    })
  }

  return (
    <div className="flex flex-col h-full bg-surface-2">
      <div className="flex items-center justify-between px-3 py-2.5  ">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Canales
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors p-1 -mr-1 sm:hidden"
            aria-label="Cerrar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="px-3 py-2  ">
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar canal..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface-1  text-slate-200 text-xs placeholder-slate-500 focus:outline-none focus: transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {sortedCategories.length === 0 && (
          <div className="px-3 py-4 text-xs text-slate-500 text-center">
            Sin canales
          </div>
        )}

        {sortedCategories.map(cat => {
          const chans = categoryGroups.get(cat.id) || []
          const isCollapsed = collapsed.has(cat.id)
          const isVoiceCategory = chans.some(c => c.channelType === 'voice')
          const visible = chans.filter(c => filterFn(c.name))

          if (visible.length === 0 && cat.name !== 'TEXTO' && cat.name !== 'VOZ') return null

          return (
            <div key={cat.id}>
              {/* Category header */}
              <button
                onClick={() => toggleCollapse(cat.id)}
                className="w-full flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 hover:text-slate-400 transition-colors"
              >
                {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {isVoiceCategory ? '🔊' : '#'}
                <span className="ml-0.5">{cat.name}</span>
              </button>

              {/* Channels in category */}
              {!isCollapsed && visible.length > 0 && (
                <div>
                  {visible.map(chan => (
                    <ChannelRow
                      key={chan.id}
                      chan={chan}
                      isActive={chan.channelType === 'voice' ? chan.id === activeVoiceChannelId : chan.name === currentChannel}
                      onSelect={() => {
                        if (chan.channelType === 'voice') {
                          if (chan.id === activeVoiceChannelId) onVoiceLeave(chan.id)
                          else onVoiceJoin(chan.id)
                        } else {
                          onSelect(chan.name)
                        }
                      }}
                      onContextMenu={(x, y) => setChMenu({ show: true, x, y, channel: chan })}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* Uncategorized channels */}
        {uncategorized.length > 0 && query && (
          <div>
            <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
              Sin categoría
            </div>
            {uncategorized.filter(c => filterFn(c.name)).map(chan => (
              <button
                key={chan.id}
                onClick={() => onSelect(chan.name)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors text-left text-slate-400 hover:bg-surface-2 hover:text-slate-200 -2 "
              >
                <Hash className="w-4 h-4 flex-shrink-0 text-slate-500" />
                <span className="truncate flex-1 font-medium">{chan.name.replace(/^#/, '')}</span>
              </button>
            ))}
          </div>
        )}

        {/* Other channels (not joined yet) — gone. Every user is in
            every channel, so this section would always be empty. */}
      </div>

      <div className="px-3 py-2  ">
        <button
          onClick={onCreateRequest}
          className="w-full flex items-center gap-2 text-xs text-slate-500 hover:text-accent transition-colors py-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Crear canal</span>
        </button>
      </div>

      <ChannelContextMenu
        state={chMenu}
        onClose={closeChMenu}
        onCopyName={(name) => onCopyName?.(name)}
        onManageMembers={onManageMembers}
        onEditTopic={onEditTopic}
        onDelete={onDelete}
      />
    </div>
  )
}

interface ChannelRowProps {
  chan: ChannelState
  isActive: boolean
  onSelect: () => void
  /** Desktop right-click and mobile long-press both call this
   *  with the (clientX, clientY) where the menu should appear. */
  onContextMenu: (x: number, y: number) => void
}

function ChannelRow({ chan, isActive, onSelect, onContextMenu }: ChannelRowProps) {
  // ponytail: each row gets its own long-press timer via the
  // shared hook. Desktop still uses onContextMenu; the hook
  // adds the touch path so mobile (iOS + Android) opens the
  // same menu after a 400ms hold. `consumeLongPressClick`
  // suppresses the synthetic click that would otherwise also
  // trigger `onSelect` when the user lifts the finger after
  // the long-press fired.
  const {
    onTouchStart: lpTouchStart,
    onTouchMove: lpTouchMove,
    onTouchEnd: lpTouchEnd,
    onTouchCancel: lpTouchCancel,
    consumeLongPressClick,
  } = useLongPress({
    onLongPress: (e) => {
      const t = e.touches[0]
      if (t) onContextMenu(t.clientX, t.clientY)
    },
  })

  const isVoice = chan.channelType === 'voice'
  const voiceCount = chan.voiceParticipants ?? 0
  const voiceNames = chan.voiceParticipantNames ?? []

  return (
    <button
      onClick={(e) => {
        if (consumeLongPressClick()) {
          e.preventDefault()
          e.stopPropagation()
          return
        }
        onSelect()
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu(e.clientX, e.clientY)
      }}
      onTouchStart={lpTouchStart}
      onTouchMove={lpTouchMove}
      onTouchEnd={lpTouchEnd}
      onTouchCancel={lpTouchCancel}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-all text-left cursor-pointer select-none [-webkit-touch-callout:none] ${
        isActive
          ? isVoice
            ? 'bg-emerald-500/15 text-emerald-200 -2 '
            : 'bg-accent/15 text-slate-100 -2 '
          : 'text-slate-400 hover:bg-surface-2 hover:text-slate-200 -2 '
      }`}
    >
      {isVoice ? (
        <span className="text-base flex-shrink-0">
          {isActive ? '🔊' : '🎧'}
        </span>
      ) : (
        <Hash className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-accent' : 'text-slate-500'}`} />
      )}
      <span className="truncate flex-1 font-medium">
        {chan.name.replace(/^🔊\s*/, '').replace(/^#/, '')}
      </span>
      {isVoice && voiceCount > 0 && voiceNames.length > 0 && (
        <span className="flex items-center flex-shrink-0">
          {voiceNames.slice(0, 3).map(p => (
            <Avatar
              key={p.userId}
              nick={p.displayName}
              size="sm"
              className="ring-2 ring-slate-900 -ml-1.5 first:ml-0 w-5 h-5 text-[9px]"
            />
          ))}
          {voiceNames.length > 3 && (
            <span className="ml-1 text-[10px] font-medium tabular-nums text-slate-500">
              +{voiceNames.length - 3}
            </span>
          )}
        </span>
      )}
      {isVoice && voiceCount > 0 && voiceNames.length === 0 && (
        <span className={`text-[10px] font-medium tabular-nums flex items-center gap-1 ${
          isActive ? 'text-emerald-300' : 'text-slate-500'
        }`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          {voiceCount}
        </span>
      )}
      {!isVoice && chan.unread > 0 && (
        <span className="bg-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center tabular-nums">
          {chan.unread}
        </span>
      )}
    </button>
  )
}
