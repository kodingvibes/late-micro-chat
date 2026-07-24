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
  let savedRaw: string | null = null
  let saved: any = null
  try {
    savedRaw = localStorage.getItem('chat.session')
    if (savedRaw) saved = JSON.parse(savedRaw)
  } catch {
    /* ignore */
  }

  const redirectCount = Number(sessionStorage.getItem('chat.sso_redirects') || '0')
  const params = new URLSearchParams(window.location.search)

  return {
    capturedAt: new Date().toISOString(),
    page: window.location.pathname,
    url: window.location.href,
    userAgent: navigator.userAgent,
    session: saved
      ? {
          hasSavedSession: true,
          savedSessionIdMasked: maskToken(saved.session_id),
          savedSessionExpiresAt: saved.expires_at ?? null,
          savedSessionUserId: saved.user?.id ?? null,
          savedSessionEmail: saved.user?.email ?? null,
          savedSessionDisplayName: saved.user?.display_name ?? null,
          savedSessionRaw: savedRaw,
        }
      : null,
    sso: {
      redirectCount,
      budget: 2,
      budgetExhausted: redirectCount >= 2,
      ssoUrl: 'https://www.kodingvibes.com/api/sso/irc-token',
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
    raw: () => localStorage.getItem('chat.session'),
  }
}
