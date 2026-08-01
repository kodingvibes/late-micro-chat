import { voiceError } from './log'

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
]

export interface VoicePeerCallbacks {
  onIceCandidate: (candidate: string) => void
  onStream: (stream: MediaStream) => void
  onConnectionState: (state: string) => void
}

export class VoicePeer {
  private pc: RTCPeerConnection
  private callbacks: VoicePeerCallbacks
  private pendingIce: string[] = []

  constructor(
    private peerId: number,
    _isInitiator: boolean,
    callbacks: VoicePeerCallbacks,
    localStream?: MediaStream,
  ) {
    this.callbacks = callbacks
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    this.pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.callbacks.onIceCandidate(JSON.stringify(e.candidate))
      }
    }

    this.pc.ontrack = (e) => {
      this.callbacks.onStream(e.streams[0])
    }

    this.pc.onconnectionstatechange = () => {
      this.callbacks.onConnectionState(this.pc.connectionState)
    }

    if (localStream) {
      localStream.getTracks().forEach(t => this.pc.addTrack(t, localStream))
    }
  }

  async createOffer(): Promise<string> {
    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)
    return JSON.stringify(offer)
  }

  async createAnswer(): Promise<string> {
    const answer = await this.pc.createAnswer()
    await this.pc.setLocalDescription(answer)
    return JSON.stringify(answer)
  }

  async handleOffer(sdp: string) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sdp)))
    // Flush pending ICE candidates
    for (const c of this.pendingIce) {
      await this.pc.addIceCandidate(JSON.parse(c))
    }
    this.pendingIce = []
  }

  async handleAnswer(sdp: string) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sdp)))
    for (const c of this.pendingIce) {
      await this.pc.addIceCandidate(JSON.parse(c))
    }
    this.pendingIce = []
  }

  async handleIce(candidate: string) {
    if (this.pc.remoteDescription) {
      await this.pc.addIceCandidate(JSON.parse(candidate))
    } else {
      this.pendingIce.push(candidate)
    }
  }

  get id() { return this.peerId }
  get connectionState() { return this.pc.connectionState }

  close() {
    this.pc.close()
  }

  /** Add the given stream's tracks to the connection and re-negotiate.
   *  Used when the local mic resolves AFTER the initial offer was sent
   *  (without an audio track). Returns the new offer SDP if we are the
   *  initiator, else the answer SDP. Returns null if neither side
   *  needs a re-negotiation. */
  async addLocalStream(stream: MediaStream): Promise<{ kind: 'offer' | 'answer'; sdp: string } | null> {
    const senders = this.pc.getSenders()
    for (const track of stream.getTracks()) {
      const hasSender = senders.some(s => s.track && s.track.kind === track.kind)
      if (!hasSender) {
        this.pc.addTrack(track, stream)
      }
    }
    // Wrapped: signalingState is read here but the SDP calls below are
    // async, so a remote offer landing in between can invalidate the
    // branch we picked and reject. Renegotiation is best-effort -- the
    // tracks are already attached either way, and the next negotiation
    // carries them -- so report and return null instead of rejecting
    // into a caller that cannot do anything useful with it.
    //
    // Branch on signalingState, not on which descriptions exist.
    // `remoteDescription` is still set once a negotiation completes, so
    // the old check sent us down createAnswer() while in `stable` —
    // which the spec requires to reject, making the whole late-mic path
    // unable to ever succeed. createAnswer is only legal with a pending
    // remote offer; renegotiating from `stable` means making an offer.
    try {
      if (this.pc.signalingState === 'have-remote-offer') {
        const answer = await this.pc.createAnswer()
        await this.pc.setLocalDescription(answer)
        return { kind: 'answer', sdp: JSON.stringify(answer) }
      }
      if (this.pc.signalingState === 'stable' && (this.pc.localDescription || this.pc.remoteDescription)) {
        const offer = await this.pc.createOffer({ iceRestart: false })
        await this.pc.setLocalDescription(offer)
        return { kind: 'offer', sdp: JSON.stringify(offer) }
      }
    } catch (err) {
      voiceError('addLocalStream: renegotiation failed', { peer: this.peerId, state: this.pc.signalingState, err })
      return null
    }
    // Nothing negotiated yet, or an offer is already in flight: the
    // tracks we just added ride along on that negotiation.
    return null
  }

  /** Restart ICE — useful when the connection has failed or
   *  disconnected and we want to try a fresh candidate gathering
   *  round. Returns the new offer SDP (we must be the initiator, or
   *  have an active remote description). */
  /** Restart ICE after the connection dropped.
   *
   * Was three branches keyed on which descriptions existed, and the
   * middle one returned null for anything with a remoteDescription --
   * which is every established connection, i.e. exactly the case this
   * function exists for. It could never actually restart anything.
   *
   * Either side may drive an ICE restart: it is an ordinary
   * renegotiation, and renegotiating from `stable` means making an
   * offer regardless of who offered first. So the only real question is
   * whether we are in a state that can produce one.
   */
  async restartIce(): Promise<string | null> {
    if (this.pc.signalingState !== 'stable') return null
    try {
      const offer = await this.pc.createOffer({ iceRestart: true })
      await this.pc.setLocalDescription(offer)
      return JSON.stringify(offer)
    } catch (err) {
      voiceError('restartIce failed', { peer: this.peerId, state: this.pc.signalingState, err })
      return null
    }
  }

}
