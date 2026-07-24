const SESSION_KEY = 'chat.session'
const SSO_URL = 'https://www.kodingvibes.com/api/sso/irc-token'
const SSO_REDIRECT_COUNT_KEY = 'chat.sso_redirects'
const MAX_SSO_REDIRECTS = 2

export function redirectToSso() {
  const next = Number(sessionStorage.getItem(SSO_REDIRECT_COUNT_KEY) || '0') + 1
  sessionStorage.setItem(SSO_REDIRECT_COUNT_KEY, String(next))
  // Always clear the session before redirecting so the SSO
  // exchange gets a fresh token. Without this, a stale token
  // would just bounce us back here and exhaust the budget.
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem('chat.channel')
  localStorage.removeItem('late_redirect')
  window.location.href = SSO_URL
}

export function ssoBudgetExhausted(): boolean {
  const count = Number(sessionStorage.getItem(SSO_REDIRECT_COUNT_KEY) || '0')
  return count >= MAX_SSO_REDIRECTS
}

export function clearSsoBudget() {
  sessionStorage.removeItem(SSO_REDIRECT_COUNT_KEY)
}

/**
 * Full sign-out: clears the session, the SSO redirect budget,
 * and the saved channel. Forces the next reload to go through
 * SSO from scratch. Use this when the user explicitly wants to
 * "log out and try again" — e.g. when a stale token is locking
 * them out of the chat.
 */
export function fullSignOut() {
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem('chat.channel')
  localStorage.removeItem('late_redirect')
  sessionStorage.removeItem(SSO_REDIRECT_COUNT_KEY)
  window.location.href = SSO_URL
}

export function getSavedSession<T>(): T | null {
  const saved = localStorage.getItem(SESSION_KEY)
  if (!saved) return null
  try {
    const parsed = JSON.parse(saved) as T
    return parsed
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[auth] session parse failed, removing', e)
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

export function saveSession<T>(session: T) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}
