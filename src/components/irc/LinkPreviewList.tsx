import { useEffect, useMemo } from 'react'
import type { OgData } from '../../lib/chat/domain/types'
import { useUnfurl, ensure, seed, fetchUnfurl } from '../../lib/chat/unfurlStore'
import { stripAttachmentMarkers } from '../../lib/chat/domain/parsers'
import LinkPreviewCard from './LinkPreviewCard'

// Mirrors the backend URL_RE (services/link_preview.py): plain
// http(s) URLs, trailing punctuation stripped so it doesn't get
// swallowed into the link (e.g. a URL at the end of a sentence).
const URL_RE = /https?:\/\/[^\s<>"']+/gi
const MAX_URLS = 3

export function extractUrls(content: string): string[] {
  // Only look at the human caption: markers and their machine payload
  // (attachment ids, data URIs) must never be unfurled.
  const caption = stripAttachmentMarkers(content)
  const matches = caption.match(URL_RE) || []
  const cleaned = matches.map((u) => u.replace(/[.,;:!?)]+$/, ''))
  return Array.from(new Set(cleaned)).slice(0, MAX_URLS)
}

interface LinkPreviewListProps {
  content: string
  ogData?: OgData | null
  onOpen: (url: string) => void
}

/**
 * One cache-subscribing child per URL so a single message's card resolving
 * doesn't re-render every other message's list. Renders nothing until a
 * URL's entry is 'done' and not an error.
 */
function LinkPreviewItem({ url, onOpen }: { url: string; onOpen: (url: string) => void }) {
  const entry = useUnfurl(url)
  if (!entry || entry.status !== 'done' || !entry.data || entry.data.kind === 'error') return null
  return <LinkPreviewCard og={entry.data} onOpen={onOpen} />
}

/**
 * Client-pull unfurl cards for a message body. Extracts up to
 * MAX_URLS links from the caption text, seeds the shared unfurl store
 * from server-pushed og_data (if present, skipping the fetch for that
 * URL), and otherwise fires a cached/debounced fetch per URL.
 */
export default function LinkPreviewList({ content, ogData, onOpen }: LinkPreviewListProps) {
  const urls = useMemo(() => extractUrls(content), [content])
  // `ensure`/`seed` are plain module functions and the parent never
  // subscribes to the cache, so it doesn't re-render when unrelated
  // URLs resolve - only the LinkPreviewItem for that URL does.

  useEffect(() => {
    if (ogData) seed(ogData)
    for (const url of urls) ensure(url, fetchUnfurl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urls, ogData])

  if (urls.length === 0) return null

  return (
    <>
      {urls.map((url) => (
        <LinkPreviewItem key={`og-${url}`} url={url} onOpen={onOpen} />
      ))}
    </>
  )
}
