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
  gateThresholdOpen: number
  gateThresholdClose: number
  gateAttack: number
  gateRelease: number
  waveShaperCurve: Float32Array | null
}

export type PresetName = 'radio-am'

export const RADIO_AM_PRESET: RadioAMPreset = {
  threshold: -40,
  ratio: 4,
  attack: 0.01,
  release: 0.15,
  knee: 10,
  makeupGain: 12,
  highpassFreq: 100,
  peakingFreq: 2500,
  peakingGain: 4,
  peakingQ: 1,
  gateThresholdOpen: -50,
  gateThresholdClose: -60,
  gateAttack: 0.02,
  gateRelease: 0.15,
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
