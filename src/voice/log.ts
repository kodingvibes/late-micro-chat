/**
 * Error channel for the voice stack.
 *
 * Every WebRTC failure used to be handed to `vdRecord`, which does
 * nothing unless the page was loaded with `?voiceDebug=1`. That is how
 * the silent-mute bug survived: `addLocalStream` rejected on every
 * single late-mic renegotiation, the rejection was recorded into a
 * disabled buffer, and the only symptom was that nobody could hear the
 * person who joined last.
 *
 * Diagnostics stay behind the debug flag. Failures do not.
 */
export function voiceError(what: string, detail?: unknown): void {
  // eslint-disable-next-line no-console
  console.error(`[voice] ${what}`, detail ?? '')
  const dbg = (window as unknown as { __voiceDebug?: { events: unknown[] } }).__voiceDebug
  // Keep it in the debug buffer too, so copy() still hands over a
  // complete picture when someone is actively debugging.
  if (dbg?.events) {
    dbg.events.push({ t: new Date().toISOString(), e: 'error:' + what, d: String(detail) })
    if (dbg.events.length > 50) dbg.events.shift()
  }
}
