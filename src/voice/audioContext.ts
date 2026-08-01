// Module-level AudioContext. Created lazily on the first user
// gesture (the "join voice channel" click) so iOS Safari's autoplay
// policy actually resumes it. Creating the context inside a useEffect
// is too late — the click handler has already returned and Safari
// considers the context "not from a user gesture", so it stays
// suspended and the MediaStreamDestination produces silent tracks.
let ctx: AudioContext | null = null

export function getOrCreateAudioContext(): AudioContext {
  // A closed context can never be reopened, and every node built on it
  // throws InvalidStateError. Nothing should be closing this one any
  // more, but returning a dead singleton forever is a bad failure mode
  // for a shared lazy getter, so replace it instead.
  if (ctx && ctx.state !== 'closed') return ctx
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!Ctor) throw new Error('Web Audio API not supported')
  ctx = new Ctor()
  ctx.addEventListener('statechange', () => { void resumeAudioContext() })
  return ctx
}

export function resumeAudioContext(): Promise<void> {
  if (!ctx) return Promise.resolve()
  // Was `state === 'suspended'`, which is the one state iOS does NOT
  // use here. Locking the screen, switching apps, switching tabs or
  // taking a phone call moves the context to 'interrupted' (MDN,
  // BaseAudioContext.state), and only 'closed' can never be resumed.
  // Because resume() was skipped for 'interrupted' and this getter
  // hands the same instance back forever, the mic's
  // MediaStreamAudioDestinationNode emitted silence for the rest of
  // the page session: the call stayed "connected", RTP kept flowing,
  // and nobody heard you again until a full page reload. Rejoining
  // could not fix it either — join calls exactly these two functions.
  if (ctx.state === 'running' || ctx.state === 'closed') return Promise.resolve()
  return ctx.resume().catch(() => {})
}

// Bring the context back by itself after an interruption. Nothing else
// in the app listened for this: resumeAudioContext() ran only at join
// time, so recovery depended on the user guessing they had to reload.
// Returning to the tab is the moment iOS allows the resume, and the
// 'statechange' listener above covers interruptions that end while the
// page is still in front (a phone call, Siri, another app grabbing the
// audio hardware).
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void resumeAudioContext()
  })
}
