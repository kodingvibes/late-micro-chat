const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV

export function log(tag: string, msg: string, data?: unknown) {
  if (!isDev && !(window as any).__lateDebug?.enabled) return
  // eslint-disable-next-line no-console
  console.debug(`[late-debug ${tag}] ${msg}`, data ?? '')
}

function maskToken(s: string | null | undefined): string {
  if (!s) return '(none)'
  if (s.length <= 12) return '***' + s.slice(-4)
  return s.slice(0, 8) + '…' + s.slice(-6) + ' (len=' + s.length + ')'
}

export function takeSnapshot() {
  const late = (typeof window !== 'undefined' && window.LateSession) || null
  const session = late?.user ?? null
  const sessionId = late?.sessionId ?? null

  const redirectCount = Number(sessionStorage.getItem('late.sso_redirects') || '0')
  const params = new URLSearchParams(window.location.search)

  return {
    capturedAt: new Date().toISOString(),
    page: window.location.pathname,
    url: window.location.href,
    userAgent: navigator.userAgent,
    session: session
      ? {
          hasSavedSession: Boolean(sessionId),
          savedSessionIdMasked: maskToken(sessionId),
          savedSessionUserId: session.id ?? null,
          savedSessionEmail: session.email ?? null,
          savedSessionDisplayName: session.display_name ?? null,
        }
      : null,
    sso: {
      redirectCount,
      budget: 2,
      budgetExhausted: redirectCount >= 2,
      ssoUrl: late?.ssoUrl ?? 'https://www.kodingvibes.com/api/sso/irc-token',
    },
    urlToken: {
      present: params.has('token'),
      masked: maskToken(params.get('token')),
      logoutFlag: params.get('logout') === '1',
    },
  }
}

if (typeof window !== 'undefined') {
  ;(window as any).__lateDebug = {
    snapshot: takeSnapshot,
    log,
    copy: async () => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(takeSnapshot(), null, 2))
        return true
      } catch {
        return false
      }
    },
    raw: () => window.LateSession?.sessionId ?? null,
  }
}
