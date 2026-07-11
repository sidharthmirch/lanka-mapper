'use client'

import { useEffect, useRef, useState } from 'react'

type FrameSubscriber = (timestamp: number) => void

const frameSubscribers = new Set<FrameSubscriber>()
let sharedFrameId: number | null = null

function runSharedFrame(timestamp: number) {
  frameSubscribers.forEach((subscriber) => subscriber(timestamp))
  sharedFrameId = frameSubscribers.size > 0 ? requestAnimationFrame(runSharedFrame) : null
}

function subscribeToSharedFrames(subscriber: FrameSubscriber) {
  frameSubscribers.add(subscriber)
  if (sharedFrameId === null) sharedFrameId = requestAnimationFrame(runSharedFrame)

  return () => {
    frameSubscribers.delete(subscriber)
    if (frameSubscribers.size === 0 && sharedFrameId !== null) {
      cancelAnimationFrame(sharedFrameId)
      sharedFrameId = null
    }
  }
}

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

  useEffect(() => {
    targetRef.current = target
  }, [target])

  useEffect(() => {
    if (!enabled) {
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
    }

    return subscribeToSharedFrames(tick)
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
