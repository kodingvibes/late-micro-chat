interface DayHeaderProps {
  ts: number
}

function formatDayLabel(ts: number): string {
  const d = new Date(ts)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const dDay = new Date(d)
  dDay.setHours(0, 0, 0, 0)
  if (dDay.getTime() === today.getTime()) return 'Hoy'
  if (dDay.getTime() === yesterday.getTime()) return 'Ayer'
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })
}

/**
 * Day separator. With the column-reverse layout we render
 * dividers as plain flow items. Because messages are rendered
 * newest-first in the DOM, the divider that visually sits
 * *above* today's messages is the *last* item of yesterday in
 * the DOM — buildDisplayList places it there, not the other way
 * around. The component itself is just the visual line + label.
 */
export default function DayHeader({ ts }: DayHeaderProps) {
  return (
    <div
      className="irc-day-header flex items-center gap-3 px-4 py-2"
      style={{ contain: 'layout paint' }}
    >
      <div className="flex-1 h-px bg-slate-800" />
      <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
        {formatDayLabel(ts)}
      </span>
      <div className="flex-1 h-px bg-slate-800" />
    </div>
  )
}
