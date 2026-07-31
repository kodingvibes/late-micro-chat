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
  return ctx
}

export function resumeAudioContext(): Promise<void> {
  if (!ctx) return Promise.resolve()
  return ctx.state === 'suspended' ? ctx.resume() : Promise.resolve()
}
