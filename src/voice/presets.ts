export interface RadioAMPreset {
  threshold: number
  ratio: number
  attack: number
  release: number
  knee: number
  makeupGain: number
  highpassFreq: number
  peakingFreq: number
  peakingGain: number
  peakingQ: number
  gateThreshold: number
  waveShaperCurve: Float32Array | null
}

export type PresetName = 'radio-am'

export const RADIO_AM_PRESET: RadioAMPreset = {
  threshold: -30,
  ratio: 12,
  attack: 0.003,
  release: 0.25,
  knee: 0,
  makeupGain: 6,
  highpassFreq: 100,
  peakingFreq: 2500,
  peakingGain: 4,
  peakingQ: 1,
  gateThreshold: -45,
  waveShaperCurve: makeAMCurve(0.5),
}

function makeAMCurve(amount: number): Float32Array {
  const samples = 256
  const curve = new Float32Array(samples)
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1
    const amt = amount / 100
    curve[i] = (1 + amt) * x - amt * x * x * x
  }
  return curve
}
