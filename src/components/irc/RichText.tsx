import { useMemo } from 'react'
import { renderRichText } from '../../lib/chat/domain/markdown'

interface RichTextProps {
  text: string
  members?: { id: number; display_name: string }[]
  isOwn?: boolean
}

/**
 * Render a message body as markdown.
 *
 * Uses a tiny custom renderer so the chat bundle avoids the cost of a
 * full markdown runtime. Supports paragraphs, inline bold/italic/code,
 * links, lists, blockquote, code blocks, br, strikethrough, @mentions,
 * mass mentions, and emoji shortcodes. Headings are intentionally left
 * as plain text.
 */
export default function RichText({ text, members, isOwn }: RichTextProps) {
  const html = useMemo(() => renderRichText(text, members, isOwn), [text, members, isOwn])

  return (
    <div
      className={`rich-text ${isOwn ? 'rich-text-own' : ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
