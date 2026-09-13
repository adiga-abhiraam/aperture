import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatElapsed, useLiveElapsed } from './useLiveElapsed'

describe('useLiveElapsed', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('advances between polls instead of jumping with them', () => {
    const { result, rerender } = renderHook(({ server, active }) => useLiveElapsed(server, active), {
      initialProps: { server: 3, active: true },
    })
    const seen: string[] = [formatElapsed(result.current)]
    // 1.5 s between polls, sampled every 250 ms like the ticker.
    for (let i = 0; i < 6; i++) {
      act(() => vi.advanceTimersByTime(250))
      seen.push(formatElapsed(result.current))
    }
    expect(new Set(seen)).toEqual(new Set(['3 s', '4 s']))
    // Next poll says 4.5 s: no jump, still whole-second steps.
    rerender({ server: 4.5, active: true })
    act(() => vi.advanceTimersByTime(500))
    expect(formatElapsed(result.current)).toBe('5 s')
  })

  it('never runs backwards when a poll arrives slightly behind the projection', () => {
    const { result, rerender } = renderHook(({ server, active }) => useLiveElapsed(server, active), {
      initialProps: { server: 10, active: true },
    })
    act(() => vi.advanceTimersByTime(2000))
    expect(result.current).toBeCloseTo(12, 1)
    rerender({ server: 11.6, active: true }) // a late-delivered poll
    expect(result.current).toBeGreaterThanOrEqual(11.9)
    // A retry resets the server clock: that is a real jump and is adopted.
    rerender({ server: 0.4, active: true })
    expect(result.current).toBeCloseTo(0.4, 1)
  })

  it('freezes on the final server value once the job stops', () => {
    const { result, rerender } = renderHook(({ server, active }) => useLiveElapsed(server, active), {
      initialProps: { server: 90, active: true },
    })
    rerender({ server: 95.4, active: false })
    act(() => vi.advanceTimersByTime(5000))
    expect(result.current).toBe(95.4)
    expect(formatElapsed(result.current)).toBe('1m 35s')
  })
})

describe('formatElapsed', () => {
  it('uses whole seconds everywhere', () => {
    expect(formatElapsed(0.9)).toBe('0 s')
    expect(formatElapsed(59.9)).toBe('59 s')
    expect(formatElapsed(60)).toBe('1m 00s')
    expect(formatElapsed(3725)).toBe('1h 02m 05s')
    expect(formatElapsed(null)).toBe('—')
  })
})
