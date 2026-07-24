/**
 * Height estimators for lazy chat content. They use the actual rendered
 * column width so the placeholder is as close as possible to the final
 * layout on every screen size, eliminating the jump when the child mounts.
 */

// Image previews render with max-h-72 (288px) and object-contain.
export function estimateImageHeight(width: number): number {
  return Math.min(width * 0.75, 288)
}

// OG cards have a 16:9 banner plus ~70px of text.
export function estimateOgHeight(width: number): number {
  if (width <= 0) return 168
  return Math.round(width * (9 / 16) + 70)
}

// Audio/voice note player is ~88px for the waveform/buttons plus
// extra labels/metadata, so 120px is a safer placeholder.
export function estimateAudioHeight(_width: number): number {
  return 120
}
