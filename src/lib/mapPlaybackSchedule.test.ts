import { describe, it, expect } from 'vitest'
import {
  buildPlaybackSchedule,
  playbackFrameLinearYear,
  playbackFrameDisplayYear,
  getPlaybackStartFrameIndex,
  getTimelinePositionForYear,
  getTimelineYearFromPosition,
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

describe('getPlaybackStartFrameIndex', () => {
  it('starts from the first frame when play is pressed at the final year', () => {
    const frames = buildPlaybackSchedule([2019, 2020, 2021], FRAMES_PER_GAP)

    expect(getPlaybackStartFrameIndex(frames, 2021)).toBe(0)
  })

  it('keeps starting from the current position before the final year', () => {
    const frames = buildPlaybackSchedule([2019, 2020, 2021], FRAMES_PER_GAP)

    expect(frames[getPlaybackStartFrameIndex(frames, 2020)].y0).toBe(2019)
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

describe('getTimelinePositionForYear', () => {
  it('maps uneven calendar gaps onto evenly spaced data stops', () => {
    const years = [2000, 2010, 2011]

    expect(getTimelinePositionForYear(years, 2000)).toBe(0)
    expect(getTimelinePositionForYear(years, 2005)).toBe(0.5)
    expect(getTimelinePositionForYear(years, 2010)).toBe(1)
    expect(getTimelinePositionForYear(years, 2010.5)).toBe(1.5)
    expect(getTimelinePositionForYear(years, 2011)).toBe(2)
  })

  it('sorts input years and clamps outside the available range', () => {
    const years = [2011, 2000, 2010]

    expect(getTimelinePositionForYear(years, 1999)).toBe(0)
    expect(getTimelinePositionForYear(years, 2015)).toBe(2)
    expect(getTimelinePositionForYear(years, 2010)).toBe(1)
  })

  it('returns zero for empty and single-year timelines', () => {
    expect(getTimelinePositionForYear([], 2020)).toBe(0)
    expect(getTimelinePositionForYear([2020], 2020)).toBe(0)
  })
})

describe('getTimelineYearFromPosition', () => {
  it('maps visual slider positions back to the nearest data year', () => {
    const years = [2000, 2010, 2011]

    expect(getTimelineYearFromPosition(years, 0)).toBe(2000)
    expect(getTimelineYearFromPosition(years, 0.49)).toBe(2000)
    expect(getTimelineYearFromPosition(years, 0.5)).toBe(2010)
    expect(getTimelineYearFromPosition(years, 1.49)).toBe(2010)
    expect(getTimelineYearFromPosition(years, 1.5)).toBe(2011)
    expect(getTimelineYearFromPosition(years, 2)).toBe(2011)
  })

  it('sorts input years and clamps positions outside the slider range', () => {
    const years = [2011, 2000, 2010]

    expect(getTimelineYearFromPosition(years, -1)).toBe(2000)
    expect(getTimelineYearFromPosition(years, 3)).toBe(2011)
    expect(getTimelineYearFromPosition(years, 1)).toBe(2010)
  })

  it('falls back to zero for an empty timeline', () => {
    expect(getTimelineYearFromPosition([], 1)).toBe(0)
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
