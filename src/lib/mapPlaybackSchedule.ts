/** Frames between each consecutive pair of data years (linear interpolation). */
export const FRAMES_PER_GAP = 12

/** Base ms per animation frame at 1× speed. Tuned with FRAMES_PER_GAP. */
export const MAP_PLAYBACK_BASE_MS = 450

/** Converts a playback speed multiplier to a setInterval duration (ms). */
export function getMapPlaybackFrameIntervalMs(speed: number): number {
  return Math.max(150, Math.round(MAP_PLAYBACK_BASE_MS / speed))
}

export type PlaybackFrame = { y0: number; y1: number; t: number }

/**
 * Expands sorted data years into frames with t ∈ [0, 1] between each pair.
 * Skips duplicate boundary frames when moving to the next pair.
 */
export function buildPlaybackSchedule(sortedYears: number[], framesPerGap: number): PlaybackFrame[] {
  const sorted = [...sortedYears].sort((a, b) => a - b)
  if (sorted.length < 2) {
    return []
  }
  const out: PlaybackFrame[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const y0 = sorted[i]
    const y1 = sorted[i + 1]
    for (let f = 0; f <= framesPerGap; f++) {
      if (i > 0 && f === 0) {
        continue
      }
      out.push({ y0, y1, t: f / framesPerGap })
    }
  }
  return out
}

/** Calendar year along the segment y0→y1 (fractional); drives the scrubber thumb during playback. */
export function playbackFrameLinearYear(frame: PlaybackFrame): number {
  return frame.y0 + (frame.y1 - frame.y0) * frame.t
}

/**
 * Integer calendar year for on-screen labels (header, tooltips). Decimal year text
 * reads as flicker during playback; round the linear year to the nearest integer
 * so the CURRENT YEAR pill counts in whole steps.
 */
export function playbackFrameDisplayYear(frame: PlaybackFrame): number {
  return Math.round(playbackFrameLinearYear(frame))
}
