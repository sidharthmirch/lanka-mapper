import { describe, it, expect } from 'vitest'
import {
  buildPlaybackSchedule,
  playbackFrameLinearYear,
  playbackFrameDisplayYear,
  getMapPlaybackFrameIntervalMs,
  FRAMES_PER_GAP,
  MAP_PLAYBACK_BASE_MS,
} from './mapPlaybackSchedule'

describe('buildPlaybackSchedule', () => {
  it('returns empty array for fewer than 2 years', () => {
    expect(buildPlaybackSchedule([], FRAMES_PER_GAP)).toEqual([])
    expect(buildPlaybackSchedule([2020], FRAMES_PER_GAP)).toEqual([])
  })

  it('produces (N-1)*(framesPerGap) frames for N years (no duplicate boundaries)', () => {
    const years = [2019, 2020, 2021]
    const frames = buildPlaybackSchedule(years, FRAMES_PER_GAP)
    // Each gap: FRAMES_PER_GAP + 1 frames, but the t=0 of the 2nd+ gap is skipped
    expect(frames).toHaveLength(2 * FRAMES_PER_GAP + 1)
  })

  it('first frame starts at t=0 of the first pair', () => {
    const frames = buildPlaybackSchedule([2020, 2021], FRAMES_PER_GAP)
    expect(frames[0]).toEqual({ y0: 2020, y1: 2021, t: 0 })
  })

  it('last frame ends at t=1 of the last pair', () => {
    const frames = buildPlaybackSchedule([2020, 2021], FRAMES_PER_GAP)
    expect(frames[frames.length - 1]).toEqual({ y0: 2020, y1: 2021, t: 1 })
  })

  it('sorts unsorted input before building frames', () => {
    const frames = buildPlaybackSchedule([2021, 2019, 2020], FRAMES_PER_GAP)
    expect(frames[0].y0).toBe(2019)
    expect(frames[0].y1).toBe(2020)
  })

  it('works with custom framesPerGap', () => {
    const frames = buildPlaybackSchedule([2020, 2021], 4)
    expect(frames).toHaveLength(5) // t = 0, 0.25, 0.5, 0.75, 1
  })

  it('no duplicate boundary frames between gaps', () => {
    const frames = buildPlaybackSchedule([2019, 2020, 2021], FRAMES_PER_GAP)
    // Frame right before second gap should have t=1 on [2019,2020]
    // Frame starting second gap should have t=0.0833... on [2020,2021]
    const lastOfFirst = frames[FRAMES_PER_GAP]
    const firstOfSecond = frames[FRAMES_PER_GAP + 1]
    expect(lastOfFirst).toEqual({ y0: 2019, y1: 2020, t: 1 })
    expect(firstOfSecond.y0).toBe(2020)
    expect(firstOfSecond.t).toBeGreaterThan(0)
  })
})

describe('playbackFrameLinearYear', () => {
  it('returns y0 at t=0', () => {
    expect(playbackFrameLinearYear({ y0: 2020, y1: 2022, t: 0 })).toBe(2020)
  })

  it('returns y1 at t=1', () => {
    expect(playbackFrameLinearYear({ y0: 2020, y1: 2022, t: 1 })).toBe(2022)
  })

  it('returns midpoint at t=0.5', () => {
    expect(playbackFrameLinearYear({ y0: 2020, y1: 2022, t: 0.5 })).toBe(2021)
  })
})

describe('playbackFrameDisplayYear', () => {
  it('returns integer y0 at t=0', () => {
    expect(playbackFrameDisplayYear({ y0: 2020, y1: 2022, t: 0 })).toBe(2020)
  })

  it('returns integer y1 at t=1', () => {
    expect(playbackFrameDisplayYear({ y0: 2020, y1: 2022, t: 1 })).toBe(2022)
  })

  it('rounds half-gap fractional year to nearest integer', () => {
    // 2020 + (2022-2020) * 0.4 = 2020.8 → rounds to 2021
    expect(playbackFrameDisplayYear({ y0: 2020, y1: 2022, t: 0.4 })).toBe(2021)
  })

  it('never returns a non-integer for any t in [0, 1]', () => {
    for (let i = 0; i <= 10; i++) {
      const y = playbackFrameDisplayYear({ y0: 2019, y1: 2024, t: i / 10 })
      expect(Number.isInteger(y)).toBe(true)
    }
  })

  it('rounds 0.5 boundary consistently (banker not required; just integer)', () => {
    const y = playbackFrameDisplayYear({ y0: 2020, y1: 2021, t: 0.5 })
    expect([2020, 2021]).toContain(y)
    expect(Number.isInteger(y)).toBe(true)
  })
})

describe('getMapPlaybackFrameIntervalMs', () => {
  it('returns MAP_PLAYBACK_BASE_MS at 1× speed', () => {
    expect(getMapPlaybackFrameIntervalMs(1)).toBe(MAP_PLAYBACK_BASE_MS)
  })

  it('halves interval at 2× speed', () => {
    expect(getMapPlaybackFrameIntervalMs(2)).toBe(MAP_PLAYBACK_BASE_MS / 2)
  })

  it('floors at 150 ms regardless of speed', () => {
    expect(getMapPlaybackFrameIntervalMs(100)).toBe(150)
  })
})
