'use client'

import { useEffect, useRef, useState } from 'react'

export interface AnimatedScalarOptions {
  /**
   * When true AND `enabled` is true, the returned value is rounded to the nearest
   * integer before being handed to the consumer. Rationale: during map playback,
   * floating-point churn in the last few decimal places looks jittery; visible
   * numbers should count in whole-integer steps while the motion is still smooth
   * because the *underlying* easing runs in full precision and rounding snaps
   * by ≥1 per tick at typical magnitudes.
   */
  roundWhileActive?: boolean
}

/**
 * Smoothly tracks `target` with a critically-damped exponential follow.
 *
 * Why not the previous easeOut-per-change?
 * - Each new `target` (every playback frame) restarted the ease from the current
 *   display. With 12 frames per year gap and 450ms base ease, multiple restarts
 *   overlapped and produced a bouncy, speed-inconsistent feel.
 * - Exponential follow reads `targetRef` every RAF frame, so a moving target is
 *   tracked without restart artefacts. The time-constant `tau` scales with the
 *   playback frame interval so higher speeds feel tighter, lower speeds softer.
 *
 * When `enabled` flips false (pause, dataset change, tab change), the display
 * snaps to `target` in one shot — no lingering ease after the player stops.
 */
export function useAnimatedScalar(
  target: number,
  enabled: boolean,
  durationMs: number,
  options?: AnimatedScalarOptions,
): number {
  const [display, setDisplay] = useState(target)
  const displayRef = useRef(target)
  const targetRef = useRef(target)
  const rafRef = useRef(0)

  useEffect(() => {
    targetRef.current = target
  }, [target])

  useEffect(() => {
    if (!enabled) {
      cancelAnimationFrame(rafRef.current)
      return
    }

    /**
     * Time-constant for the first-order follow. `durationMs / 3` means the
     * display covers ~95% of the remaining distance in one playback frame —
     * fast enough to keep up with a moving target, slow enough to smooth out
     * tiny per-frame jumps.
     */
    const tau = Math.max(16, durationMs / 3)
    let last = performance.now()

    const tick = (now: number) => {
      const dt = Math.min(100, Math.max(0, now - last))
      last = now
      const k = 1 - Math.exp(-dt / tau)
      const next = displayRef.current + (targetRef.current - displayRef.current) * k
      displayRef.current = next
      setDisplay(next)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [enabled, durationMs])

  useEffect(() => {
    if (!enabled) {
      displayRef.current = target
      setDisplay(target)
    }
  }, [target, enabled])

  const base = enabled ? display : target
  return options?.roundWhileActive && enabled ? Math.round(base) : base
}
