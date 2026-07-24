import { RADIO_AM_PRESET } from './presets'

export interface VoiceChain {
  ctx: AudioContext
  processedStream: MediaStream
  destroy: () => void
}

export function createVoiceChain(
  inputStream: MediaStream,
  amount = 50,
): VoiceChain {
  const ctx = new AudioContext()
  const source = ctx.createMediaStreamSource(inputStream)
  const ratio = 1 + (amount / 100) * 19

  const highpass = ctx.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.value = RADIO_AM_PRESET.highpassFreq || 0
  highpass.Q.value = 0.7

  const gateAnalyser = ctx.createAnalyser()
  gateAnalyser.fftSize = 128

  const gateGain = ctx.createGain()
  gateGain.gain.value = 1

  const compressor = ctx.createDynamicsCompressor()
  compressor.threshold.value = RADIO_AM_PRESET.threshold
  compressor.ratio.value = ratio
  compressor.attack.value = RADIO_AM_PRESET.attack
  compressor.release.value = RADIO_AM_PRESET.release
  compressor.knee.value = RADIO_AM_PRESET.knee

  const peaking = ctx.createBiquadFilter()
  peaking.type = 'peaking'
  peaking.frequency.value = RADIO_AM_PRESET.peakingFreq || 0
  peaking.gain.value = RADIO_AM_PRESET.peakingGain || 0
  peaking.Q.value = RADIO_AM_PRESET.peakingQ || 1

  let waveShaper: WaveShaperNode | null = null
  if (RADIO_AM_PRESET.waveShaperCurve) {
    waveShaper = ctx.createWaveShaper()
    // @ts-ignore
    waveShaper.curve = RADIO_AM_PRESET.waveShaperCurve
  }

  const makeup = ctx.createGain()
  makeup.gain.value = RADIO_AM_PRESET.makeupGain || 0

  const destination = ctx.createMediaStreamDestination()

  source.connect(highpass)
  highpass.connect(gateAnalyser)
  gateAnalyser.connect(gateGain)
  gateGain.connect(compressor)
  compressor.connect(peaking)
  if (waveShaper) {
    peaking.connect(waveShaper)
    waveShaper.connect(makeup)
  } else {
    peaking.connect(makeup)
  }
  makeup.connect(destination)

  const gateTimer = setInterval(() => {
    const data = new Uint8Array(gateAnalyser.frequencyBinCount)
    gateAnalyser.getByteTimeDomainData(data)
    let sum = 0
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128
      sum += v * v
    }
    const rmsDb = 20 * Math.log10(Math.sqrt(sum / data.length) || 1e-10)
    const target = rmsDb > RADIO_AM_PRESET.gateThreshold ? 1 : 0
    gateGain.gain.setTargetAtTime(target, ctx.currentTime, 0.05)
  }, 50)

  return {
    ctx,
    get processedStream() { return destination.stream },
    destroy() {
      clearInterval(gateTimer)
      ctx.close()
    },
  }
}
