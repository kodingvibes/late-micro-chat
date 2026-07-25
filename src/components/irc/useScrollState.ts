import { useEffect, useRef, useState, useCallback } from 'react'

export type ScrollState = 'PINNED_BOTTOM' | 'FREE_SCROLL' | 'LOADING_HISTORY'

interface UseScrollStateOptions {
  /** Element where the chat content lives. The hook attaches two
   *  IntersectionObservers to it: one for the top sentinel (load
   *  history) and one for the bottom sentinel (back to bottom). */
  scrollEl: HTMLElement | null
  /** Called when the top sentinel becomes visible. The hook
   *  transitions to LOADING_HISTORY for the duration of the call;
   *  once the promise resolves, it returns to FREE_SCROLL. */
  onLoadMore?: () => Promise<void> | void
  /** Skip the next automatic transition to LOADING_HISTORY. Set
   *  right after a programmatic history load. */
  skipNextLoad?: boolean
}

export interface ScrollSentinels {
  /** ponytail: callback-style ref for the top sentinel. The
   *  hook uses a callback (not a useRef object) because the
   *  observers have to be re-attached when the DOM element
   *  first mounts — useRef objects don't trigger useEffect
   *  re-runs when their .current changes from null to a node. */
  topSentinelRef: (el: HTMLDivElement | null) => void
  bottomSentinelRef: (el: HTMLDivElement | null) => void
}

interface UseScrollStateResult extends ScrollSentinels {
  state: ScrollState
  /** Increment when a new live message arrives while the user is
   *  not pinned to the bottom. The badge uses this to show how
   *  many new lines are waiting. */
  pendingCount: number
  /** Reset the counter and snap back to the bottom (transition
   *  to PINNED_BOTTOM). Called from the "new messages" button. */
  jumpToBottom: () => void
  /** Imperative: "user sent a message, force the view to the
   *  bottom and clear the pending counter". */
  forcePinned: () => void
  /** Bump the pending counter without auto-scrolling. */
  bumpPending: (n?: number) => void
  /** Set the state directly (used by the virtual list to flag
   *  LOADING_HISTORY while a fetch is in flight, and to step
   *  back to FREE_SCROLL when it lands). */
  setState: (s: ScrollState) => void
  /** Notify the state machine that a new live message just
   *  landed. The hook decides whether to force the viewport
   *  to the bottom (own message), bump the pending counter
   *  (other user's message, user scrolled up), or do nothing
   *  (user is in FREE_SCROLL/LOADING_HISTORY). */
  onNewMessage: (opts: { isOwn: boolean }) => void
  /** Read the latest state synchronously, bypassing React's
   *  one-render-behind state semantics. Useful in effects
   *  that need to branch on the current scroll state. */
  getState: () => ScrollState
}

/**
 * Discrete scroll state machine. Replaces the previous
 * "distance from bottom < N" continuous logic with three states
 * and two IntersectionObservers. Each state has explicit
 * transitions, so the only times the list reflows are when one
 * of those transitions actually fires — not on every scroll
 * tick.
 */
export function useScrollState({ scrollEl, onLoadMore, skipNextLoad }: UseScrollStateOptions): UseScrollStateResult {
  const [state, setStateRaw] = useState<ScrollState>('PINNED_BOTTOM')
  const [pendingCount, setPendingCount] = useState(0)
  const topElRef = useRef<HTMLDivElement | null>(null)
  const bottomElRef = useRef<HTMLDivElement | null>(null)
  const topSentinelRef = useCallback((el: HTMLDivElement | null) => {
    topElRef.current = el
  }, [])
  const bottomSentinelRef = useCallback((el: HTMLDivElement | null) => {
    bottomElRef.current = el
  }, [])
  const skipRef = useRef(false)
  const loadingRef = useRef(false)
  const onLoadMoreRef = useRef(onLoadMore)
  onLoadMoreRef.current = onLoadMore

  useEffect(() => {
    skipRef.current = !!skipNextLoad
  }, [skipNextLoad])

  const setState = useCallback((s: ScrollState) => setStateRaw(s), [])

  const jumpToBottom = useCallback(() => {
    setPendingCount(0)
    setStateRaw('PINNED_BOTTOM')
    if (scrollEl) scrollEl.scrollTop = 0
  }, [scrollEl])

  const forcePinned = useCallback(() => {
    setPendingCount(0)
    setStateRaw('PINNED_BOTTOM')
    if (scrollEl) scrollEl.scrollTop = 0
  }, [scrollEl])

  const bumpPending = useCallback((n = 1) => {
    setPendingCount((c) => c + n)
  }, [])

  // ponytail: read the latest state synchronously. Used by the
  // caller inside an effect that needs to know whether to bump
  // the pending counter (don't bump if we're already pinned) or
  // to override (force-pinned on own messages). The internal
  // stateRef is updated on every render so the value is always
  // current, even though React state itself is one render
  // behind inside effects.
  const stateRef = useRef<ScrollState>('PINNED_BOTTOM')
  useEffect(() => { stateRef.current = state }, [state])
  const getState = useCallback(() => stateRef.current, [])

  const onNewMessage = useCallback((opts: { isOwn: boolean }) => {
    const cur = stateRef.current
    if (opts.isOwn) {
      setPendingCount(0)
      setStateRaw('PINNED_BOTTOM')
      if (scrollEl) scrollEl.scrollTop = 0
    } else if (cur === 'PINNED_BOTTOM') {
      // The bottom sentinel is in view; the new message is
      // already visible. No counter bump, no scroll.
    } else if (cur === 'LOADING_HISTORY') {
      // Don't bump while history is loading — the user is
      // actively paging through old messages and the live
      // message is irrelevant to that view.
    } else {
      setPendingCount((c) => c + 1)
    }
  }, [scrollEl])

  useEffect(() => {
    if (!scrollEl) return
    if (typeof IntersectionObserver === 'undefined') return

    const topObs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          if (loadingRef.current) continue
          if (skipRef.current) { skipRef.current = false; continue }
          if (!onLoadMoreRef.current) continue
          loadingRef.current = true
          setStateRaw('LOADING_HISTORY')
          Promise.resolve(onLoadMoreRef.current())
            .catch(() => {})
            .finally(() => {
              loadingRef.current = false
              // After history lands, the layout is back to FREE_SCROLL.
              setStateRaw((prev) => (prev === 'LOADING_HISTORY' ? 'FREE_SCROLL' : prev))
            })
        }
      },
      { root: scrollEl, rootMargin: '0px 0px 0px 0px', threshold: 0 },
    )

    const bottomObs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setPendingCount(0)
            setStateRaw((prev) => (prev === 'LOADING_HISTORY' ? prev : 'PINNED_BOTTOM'))
          } else if (!loadingRef.current) {
            setStateRaw((prev) => (prev === 'LOADING_HISTORY' ? prev : 'FREE_SCROLL'))
          }
        }
      },
      { root: scrollEl, rootMargin: '0px 0px 0px 0px', threshold: 0 },
    )

    // ponytail: the sentinels may not have mounted yet (the hook
    // runs before JSX). Wait one microtask via rAF and pick up
    // whatever's in the ref by then. This is cheap and only
    // happens once per (scrollEl, onLoadMore) change.
    const raf = requestAnimationFrame(() => {
      if (topElRef.current) topObs.observe(topElRef.current)
      if (bottomElRef.current) bottomObs.observe(bottomElRef.current)
    })

    return () => {
      cancelAnimationFrame(raf)
      topObs.disconnect()
      bottomObs.disconnect()
    }
  }, [scrollEl])

  return {
    state,
    pendingCount,
    jumpToBottom,
    forcePinned,
    bumpPending,
    onNewMessage,
    getState,
    setState,
    topSentinelRef,
    bottomSentinelRef,
  }
}
