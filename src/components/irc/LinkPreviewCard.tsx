import type { OgData } from '../../lib/chat/domain/types'

interface LinkPreviewCardProps {
  og: OgData
  onOpen: (url: string) => void
}

/**
 * WhatsApp-style OG preview card for the client-pull unfurl path
 * (see LinkPreviewList). The preview image always sits ON TOP as a
 * full-width banner with a fixed 16:9 aspect ratio, so every card has
 * the same shape regardless of the source image's real dimensions.
 * Text (site name, title, description) sits below. Only rendered for
 * kind === 'link' - callers should not pass an 'error' result in here.
 *
 * Width comes from the message column, not from the card: `data-og-card`
 * lets MessageList lock the column to the message max-width whenever a
 * card is present, so the card and its bubble are always flush.
 *
 * ponytail: the wrapper is rendered with a fixed height by the
 * parent (LinkPreviewList reserves 168px per URL). h-full + overflow-
 * hidden keep the card from reflowing the chat when the resolved
 * image is taller than 16:9 or the description is multi-line.
 */
export default function LinkPreviewCard({ og, onOpen }: LinkPreviewCardProps) {
  const hasImage = !!og.image
  const title = og.title || hostnameOf(og.url)
  const siteName = og.site_name || hostnameOf(og.url)

  return (
    <button
      type="button"
      onClick={() => onOpen(og.url)}
      data-og-card
      className="block w-full h-full text-left rounded-lg border-l-4 border-accent border border-accent/20 bg-surface-2 hover:bg-surface-2 transition-colors overflow-hidden"
      aria-label={`Abrir ${title}`}
    >
      {hasImage && (
        <div className="w-full aspect-video bg-surface-1 shrink-0">
          <img
            src={og.image}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              // Hide the banner if the image URL 404s.
              (e.currentTarget.parentElement as HTMLElement | null)?.remove()
            }}
          />
        </div>
      )}
      <div className="min-w-0 p-2.5 overflow-hidden">
        {siteName && (
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 truncate">
            {siteName}
          </div>
        )}
        <div className="text-sm font-semibold text-accent hover:underline line-clamp-2 leading-snug mt-0.5">
          {title}
        </div>
        {og.description && (
          <div className="text-xs text-slate-400 line-clamp-2 mt-0.5">
            {og.description}
          </div>
        )}
      </div>
    </button>
  )
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}
