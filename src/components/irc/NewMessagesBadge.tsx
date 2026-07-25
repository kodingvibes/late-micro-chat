interface NewMessagesBadgeProps {
  count: number
  onClick: () => void
}

/**
 * Floats over the chat when the user has scrolled up and new
 * messages have arrived. The bottom of the badge is the bottom
 * of the viewport (position: absolute, bottom-4); it never
 * occupies flow space, so the chat layout underneath is
 * unaffected. Click it to jump back to the bottom and clear
 * the counter.
 */
export default function NewMessagesBadge({ count, onClick }: NewMessagesBadgeProps) {
  if (count <= 0) return null
  const label = count === 1 ? '1 mensaje nuevo' : `${count} mensajes nuevos`
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute bottom-4 right-4 sm:right-6 z-20 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent hover:bg-accent-soft text-white shadow-lg text-xs font-medium transition-colors animate-menu-up"
      aria-label={label}
    >
      <span>{label}</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  )
}
