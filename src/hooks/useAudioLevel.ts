import { useEffect, useRef, useState } from 'react'
import { getOrCreateAudioContext } from '../voice/audioContext'

export function useAudioLevel(stream: MediaStream | null): number {
  const [level, setLevel] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (!stream) {
      setLevel(0)
      return
    }
    // ponytail: the shared singleton, not `new AudioContext()`. Every
    // ParticipantTile mounts one of these plus a SpectrumAnalyzer, so a
    // room of N peers was opening 2N+4 concurrent contexts -- the exact
    // pattern that already produced browser-limit errors here. Worse,
    // those contexts were built inside an effect, i.e. outside the join
    // click's user gesture, so on iOS they started suspended and were
    // never resumed: a suspended context does not render, the analyser
    // buffer stayed at its silent value, `level` read 0 forever and VAD
    // could never open the mic. The singleton is created and resumed by
    // the join handler, so it is awake.
    const ctx = getOrCreateAudioContext()
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 64
    source.connect(analyser)

    const data = new Uint8Array(analyser.frequencyBinCount)
    const tick = () => {
      analyser.getByteTimeDomainData(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / data.length)
      setLevel(rms)
      rafRef.current = requestAnimationFrame(tick)
    }
    tick()

    // requestAnimationFrame does not run while the page is hidden, so
    // `level` freezes at whatever it was when the screen locked. VAD
    // only closes the mic gate when it sees a level BELOW the
    // threshold, so freezing mid-word left the gate open and the mic
    // live for as long as the phone stayed in your pocket. Report
    // silence on the way out instead.
    const onHidden = () => { if (document.hidden) setLevel(0) }
    document.addEventListener('visibilitychange', onHidden)

    return () => {
      cancelAnimationFrame(rafRef.current)
      document.removeEventListener('visibilitychange', onHidden)
      // Disconnect our node; never close the shared context.
      source.disconnect()
    }
  }, [stream])

  return level
}
