import { useSyncExternalStore } from 'react'
import type { OgData } from './domain/types'
import { getSavedSession } from './services/auth-service'

type UnfurlStatus = 'loading' | 'done' | 'error'

export interface UnfurlEntry {
  status: UnfurlStatus
  data?: OgData
}

/**
 * Shared unfurl cache for link previews, as a plain module store read
 * through useSyncExternalStore - no state library, matching the shell's
 * move away from zustand.
 *
 * Subscribers are keyed by URL so a card resolving only re-renders the
 * one message that shows it, not every preview on screen. Entry objects
 * are replaced (never mutated), so getSnapshot returns a stable
 * reference between updates, which is what useSyncExternalStore needs
 * to avoid an infinite render loop.
 */
const cache = new Map<string, UnfurlEntry>()
const subscribers = new Map<string, Set<() => void>>()

// Per-URL debounce timers, kept out of the cache since the UI never
// needs to re-render on them.
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()
const DEBOUNCE_MS = 150

function emit(url: string) {
  const subs = subscribers.get(url)
  if (!subs) return
  for (const fn of subs) fn()
}

function setEntry(url: string, entry: UnfurlEntry) {
  cache.set(url, entry)
  emit(url)
}

function subscribe(url: string, onChange: () => void): () => void {
  let subs = subscribers.get(url)
  if (!subs) {
    subs = new Set()
    subscribers.set(url, subs)
  }
  subs.add(onChange)
  return () => {
    subs.delete(onChange)
    if (subs.size === 0) subscribers.delete(url)
  }
}

/** Subscribe to one URL's cache entry. `undefined` until `ensure` runs. */
export function useUnfurl(url: string): UnfurlEntry | undefined {
  return useSyncExternalStore(
    (onChange) => subscribe(url, onChange),
    () => cache.get(url),
    () => cache.get(url),
  )
}

/** Kick off a fetch for `url` unless it is already loading/resolved. */
export function ensure(url: string, fetcher: (url: string) => Promise<OgData>) {
  if (cache.has(url)) return
  setEntry(url, { status: 'loading' })

  const existing = debounceTimers.get(url)
  if (existing) clearTimeout(existing)
  debounceTimers.set(
    url,
    setTimeout(() => {
      debounceTimers.delete(url)
      fetcher(url)
        .then((data) => {
          setEntry(url, data.kind === 'error' ? { status: 'error' } : { status: 'done', data })
        })
        .catch(() => {
          setEntry(url, { status: 'error' })
        })
    }, DEBOUNCE_MS),
  )
}

/** Seed the cache from a server-pushed og_data, skipping the fetch. */
export function seed(data: OgData) {
  if (cache.has(data.url)) return
  setEntry(data.url, { status: 'done', data })
}

/**
 * Default fetcher: thin wrapper over the unfurl endpoint. There is no
 * shared ChatClient singleton reachable from here, so this reads the
 * saved session directly (same source ChatClient itself is seeded
 * from) to attach the Bearer token.
 */
export async function fetchUnfurl(url: string): Promise<OgData> {
  const session = getSavedSession<{ session_id: string }>()
  const headers: Record<string, string> = {}
  if (session?.session_id) headers.Authorization = `Bearer ${session.session_id}`

  const res = await fetch(`/api/chat/unfurl?url=${encodeURIComponent(url)}`, { headers })
  if (!res.ok) return { url, kind: 'error' }
  return res.json()
}
