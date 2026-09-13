import { useEffect, useRef, useState } from 'react'

/**
 * A smoothly ticking elapsed-time counter for a running job.
 *
 * The backend reports elapsed seconds only when polled, so showing that
 * value directly skips (3 → 4 → 6 → 7 s at a 1.5 s poll). Each server value
 * becomes an anchor and the browser advances it between polls; every poll
 * re-syncs, so the counter never drifts and never runs backwards.
 */
export function useLiveElapsed(serverSeconds: number | null | undefined, active: boolean): number | null {
  const anchor = useRef<{ seconds: number; at: number } | null>(null)
  const lastServer = useRef<number | null | undefined>(undefined)
  const [now, setNow] = useState(() => Date.now())

  // Re-anchor only when a poll delivers a new value; re-rendering on each
  // tick must not reset the clock.
  if (serverSeconds !== lastServer.current) {
    lastServer.current = serverSeconds
    if (serverSeconds != null && Number.isFinite(serverSeconds)) {
      const current = anchor.current
      const projected = current ? current.seconds + (Date.now() - current.at) / 1000 : -Infinity
      // Adopt the server value when it is ahead of the local clock, or so
      // far behind that the job must have restarted; a poll that arrives a
      // fraction of a second late must not step the counter backwards.
      const restarted = serverSeconds < projected - 5
      if (!current || !active || serverSeconds >= projected || restarted) anchor.current = { seconds: serverSeconds, at: Date.now() }
    } else if (serverSeconds == null) {
      anchor.current = null
    }
  }

  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [active])

  const current = anchor.current
  if (!current) return null
  if (!active) return current.seconds
  return current.seconds + Math.max(0, now - current.at) / 1000
}

/** Whole seconds, so a live counter advances one step at a time. */
export function formatElapsed(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const total = Math.floor(value)
  if (total < 60) return `${total} s`
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  if (minutes < 60) return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${(minutes % 60).toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`
}
