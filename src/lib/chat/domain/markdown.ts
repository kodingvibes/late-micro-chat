import { renderEmojiShortcodes } from '../../emoji'

const ALLOWED_PROTOCOLS = ['http:', 'https:', 'mailto:']

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttr(text: string): string {
  return text.replace(/"/g, '&quot;')
}

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isSafeHref(href: string): boolean {
  try {
    const url = new URL(href, 'https://example.com')
    return ALLOWED_PROTOCOLS.includes(url.protocol)
  } catch {
    // Relative-ish or malformed hrefs are allowed but forced through escapeAttr.
    return true
  }
}

function renderLink(href: string, title: string): string {
  if (!isSafeHref(href)) {
    return escapeHtml(href)
  }
  const safeHref = escapeAttr(href)
  const titleAttr = title ? ` title="${escapeAttr(title)}"` : ''
  return `<a href="${safeHref}"${titleAttr} target="_blank" rel="noopener noreferrer">${escapeHtml(title || href)}</a>`
}

const AUTO_LINK_RE = /\bhttps?:\/\/[^\s<>"'{}|\^`[\]]+/gi
const LINK_RE = /\[([^\]\n]*)\]\(([^\s\)\n]+)(?:\s+"([^"\n]*)")?\)/g
const BOLD_RE = /\*\*([^*\n]+)\*\*/g
const ITALIC_RE = /(?<![*\w])\*([^*\n]+)\*(?![*\w])|(?<![_\w])_([^_\n]+)_(?![_\w])/g
const DEL_RE = /~~([^~\n]+)~~/g
const CODE_RE = /`([^`\n]+)`/g

/**
 * Render a single line of inline markdown.
 * Supported: bold **x**, italic *x* or _x_, del ~~x~~, code `x`,
 * links [text](url), and autolinks http(s)://... .
 */
export function inlineMarkdown(text: string): string {
  return text
    .replace(LINK_RE, (_, label, href, title) => renderLink(href, label || title || ''))
    .replace(AUTO_LINK_RE, href => renderLink(href, ''))
    .replace(BOLD_RE, (_, inner) => `<strong>${escapeHtml(inner)}</strong>`)
    .replace(ITALIC_RE, (_, a, b) => `<em>${escapeHtml(a ?? b)}</em>`)
    .replace(DEL_RE, (_, inner) => `<del>${escapeHtml(inner)}</del>`)
    .replace(CODE_RE, (_, inner) => `<code>${escapeHtml(inner)}</code>`)
}

function protectMentions(
  text: string,
  members: { id: number; display_name: string }[] | undefined,
): string {
  if (!members || members.length === 0) return text
  const nicks = members
    .map(m => m.display_name)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
  if (nicks.length === 0) return text
  const pattern = new RegExp(`@(${nicks.map(escapeRe).join('|')})(?=\\b)`, 'g')
  return text.replace(pattern, (_, name) => {
    return `<strong class="mention">@${escapeHtml(name)}</strong> `
  })
}

function renderInlineSegment(text: string): string {
  if (text.includes('`')) {
    const parts: string[] = []
    let i = 0
    while (i < text.length) {
      const backtick = text.indexOf('`', i)
      if (backtick === -1) {
        parts.push(inlineMarkdown(text.slice(i)))
        break
      }
      if (backtick > i) {
        parts.push(inlineMarkdown(text.slice(i, backtick)))
      }
      const close = text.indexOf('`', backtick + 1)
      if (close === -1) {
        parts.push(inlineMarkdown(text.slice(backtick)))
        break
      }
      parts.push(`<code>${escapeHtml(text.slice(backtick + 1, close))}</code>`)
      i = close + 1
    }
    return parts.join('')
  }
  return inlineMarkdown(text)
}

function splitParagraphs(text: string): string[] {
  return text.split(/\n{2,}/)
}

function renderList(lines: string[]): string {
  const items: string[] = []
  for (const line of lines) {
    const trimmed = line.replace(/^[-*]\s+/, '')
    items.push(`<li>${renderInlineSegment(trimmed)}</li>`)
  }
  return `<ul>${items.join('')}</ul>`
}

function renderBlockquote(line: string): string {
  const trimmed = line.replace(/^>\s+/, '')
  return `<blockquote>${renderInlineSegment(trimmed)}</blockquote>`
}

function renderCodeBlock(content: string, language?: string): string {
  return `<pre><code${language ? ` class="language-${escapeHtml(language)}"` : ''}>${escapeHtml(content)}</code></pre>`
}

function renderBlock(block: string): string {
  const lines = block.split('\n')
  if (lines.length === 0) return ''
  const first = lines[0]
  if (/^[-*]\s/.test(first)) {
    return renderList(lines)
  }
  if (/^>\s/.test(first)) {
    return renderBlockquote(block.replace(/^>\s+/gm, ''))
  }
  return `<p>${renderInlineSegment(block.replace(/\n/g, '<br>'))}</p>`
}

/**
 * Render message body markdown for RichText.
 * Supports inline styles, line breaks, mentions, mass mentions, emoji
 * shortcodes, paragraphs, lists, blockquotes and triple-backtick code blocks.
 * Raw HTML is escaped; only http/https/mailto links are emitted.
 */
export function renderRichText(
  text: string,
  members?: { id: number; display_name: string }[],
  _isOwn?: boolean,
): string {
  // 1) Replace :name: shortcodes with inline SVG emoji before any escaping.
  const withEmojis = renderEmojiShortcodes(text)

  // 2) Mass mentions.
  const withMassMentions = withEmojis.replace(
    /@(todos|all|here|aqui|channel|everyone)\b/gi,
    '<strong class="mention mention-mass">@$1</strong> ',
  )

  // 3) Protect @nick mentions so they survive markdown parsing.
  const protectedText = protectMentions(withMassMentions, members)

  // 4) Extract fenced code blocks first so their contents are not parsed.
  const codeBlocks: string[] = []
  const withoutCode = protectedText.replace(
    /^```([\w-]*)\n([\s\S]*?)\n```$/gm,
    (_, lang, content) => {
      codeBlocks.push(renderCodeBlock(content, lang || undefined))
      return `\u0000CODE${codeBlocks.length - 1}\u0000`
    },
  )

  // 5) Split into paragraphs/blocks and render each.
  const rawBlocks = splitParagraphs(withoutCode)
  const renderedBlocks = rawBlocks.map(block => {
    if (/^\u0000CODE\d+\u0000$/.test(block.trim())) {
      const index = Number(block.trim().slice(5, -1))
      return codeBlocks[index] ?? ''
    }
    return renderBlock(block)
  })

  return renderedBlocks.join('')
}
