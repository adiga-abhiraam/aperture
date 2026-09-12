import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Cpu,
  Film,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Square,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react'
import { PageShell } from '../components/PageShell'
import { navigate } from '../lib/router'
import {
  cancelJob,
  deleteJob,
  displayTitle,
  formatClock,
  formatRelative,
  formatSeconds,
  jobUrls,
  listJobs,
  startJob,
  stageLabel,
  uiStatus,
  uploadJob,
  JobsApiError,
  type Engine,
  type JobSummary,
  type UiStatus,
} from '../lib/jobs'
import { formatBytes } from '../lib/format'

const POLL_ACTIVE_MS = 1500
const POLL_IDLE_MS = 8000
const ACCEPTED = ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v']

type Filter = 'all' | 'ready' | 'processing' | 'unprocessed' | 'failed'

const STATUS_STYLE: Record<UiStatus, { label: string; className: string }> = {
  ready: { label: 'Ready', className: 'border-emerald-400/40 bg-emerald-950/90 text-emerald-200' },
  processing: { label: 'Processing', className: 'border-glow/50 bg-ink-900/90 text-glow-soft' },
  queued: { label: 'Queued', className: 'border-glow/40 bg-ink-900/90 text-glow-soft/80' },
  unprocessed: { label: 'Not processed', className: 'border-white/20 bg-ink-900/90 text-paper-300/80' },
  failed: { label: 'Failed', className: 'border-red-400/40 bg-red-950/90 text-red-200' },
  cancelled: { label: 'Stopped', className: 'border-amber-400/40 bg-amber-950/90 text-amber-200' },
}

function StatusBadge({ status }: { status: UiStatus }) {
  const style = STATUS_STYLE[status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium shadow-[0_1px_8px_rgba(0,0,0,0.6)] backdrop-blur-md ${style.className}`}>
      {(status === 'processing' || status === 'queued') && <Loader2 size={11} className="animate-spin" />}
      {style.label}
    </span>
  )
}

interface PendingUpload {
  id: string
  name: string
  size: number
  fraction: number
  error?: string
}

function VideoCard({
  job,
  busy,
  onOpen,
  onStart,
  onStop,
  onDelete,
}: {
  job: JobSummary
  busy: boolean
  onOpen: () => void
  onStart: () => void
  onStop: () => void
  onDelete: () => void
}) {
  const status = uiStatus(job.status)
  const m = job.metadata ?? {}
  const percent = Math.round(Math.max(0, Math.min(1, job.progress)) * 100)
  const active = status === 'processing' || status === 'queued'

  return (
    <article className="liquid-glass group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-900/70 transition-colors hover:border-white/20">
      <button type="button" onClick={onOpen} className="relative block aspect-video w-full overflow-hidden bg-ink-950 text-left">
        <img
          src={jobUrls.thumbnail(job.job_id)}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          onError={(event) => {
            ;(event.currentTarget as HTMLImageElement).style.visibility = 'hidden'
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <span className="absolute bottom-2 right-2 rounded-md bg-black/80 px-1.5 py-0.5 font-mono text-[11px] text-white">
          {formatClock(m.duration ?? 0)}
        </span>
        <span className="absolute left-2 top-2">
          <StatusBadge status={status} />
        </span>
        {status === 'ready' && (
          <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-glow text-black shadow-glow">
              <Play size={20} className="ml-0.5" fill="currentColor" />
            </span>
          </span>
        )}
        {active && (
          <span className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
            <span className="block h-full bg-glow transition-[width] duration-700" style={{ width: `${percent}%` }} />
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <button type="button" onClick={onOpen} className="block w-full truncate text-left text-sm font-medium text-paper-100 hover:text-white">
            {displayTitle(job)}
          </button>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-paper-300/50">
            <span>{formatRelative(job.created_at)}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <Cpu size={11} />
              Local engine
            </span>
            {m.width && m.height && (
              <>
                <span aria-hidden>·</span>
                <span>
                  {m.width}×{m.height}
                </span>
              </>
            )}
          </p>
        </div>

        {active ? (
          <div className="rounded-xl border border-glow/20 bg-glow/5 px-3 py-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-glow-soft">{stageLabel(job.stage)}</span>
              <span className="font-mono text-paper-300/70">{percent}%</span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-glow transition-[width] duration-700" style={{ width: `${percent}%` }} />
            </div>
            <p className="mt-1.5 font-mono text-[10px] text-paper-300/50">
              {job.total_windows > 0 ? `${Math.min(job.total_windows, Math.round(job.progress * job.total_windows))}/${job.total_windows} windows · ` : ''}
              running {formatSeconds(job.processing_seconds)}
            </p>
          </div>
        ) : (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            <dt className="text-paper-300/45">Upload</dt>
            <dd className="text-right font-mono text-paper-300/80">{formatSeconds(m.upload_seconds)}</dd>
            <dt className="text-paper-300/45">Processing</dt>
            <dd className="text-right font-mono text-paper-300/80">
              {status === 'unprocessed' ? '—' : formatSeconds(job.processing_seconds)}
            </dd>
            <dt className="text-paper-300/45">Indexed</dt>
            <dd className="text-right font-mono text-paper-300/80">
              {status === 'ready' ? `${job.indexed_windows}/${job.total_windows} windows` : '—'}
            </dd>
          </dl>
        )}

        {status === 'failed' && job.errors[0]?.message && (
          <p className="flex items-start gap-1.5 text-[11px] leading-snug text-red-200/80">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <span className="line-clamp-2">{job.errors[0].message}</span>
          </p>
        )}

        <div className="mt-auto flex items-center gap-2 pt-1">
          {active ? (
            <button
              type="button"
              onClick={onStop}
              disabled={busy}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-amber-300/30 px-3 py-1.5 text-xs text-amber-100 transition-colors hover:bg-amber-300/10 disabled:opacity-40"
            >
              <Square size={12} fill="currentColor" /> Stop
            </button>
          ) : status === 'ready' ? (
            <button
              type="button"
              onClick={onOpen}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-glow px-3 py-1.5 text-xs font-medium text-black transition-opacity hover:opacity-90"
            >
              <Play size={12} fill="currentColor" /> Watch & ask
            </button>
          ) : (
            <button
              type="button"
              onClick={onStart}
              disabled={busy}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-glow px-3 py-1.5 text-xs font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {status === 'unprocessed' ? <Zap size={12} /> : <RefreshCw size={12} />}
              {status === 'unprocessed' ? 'Process' : 'Retry'}
            </button>
          )}
          {status === 'ready' && (
            <button
              type="button"
              onClick={onStart}
              disabled={busy}
              title="Process again"
              className="inline-flex items-center justify-center rounded-full border border-white/15 p-2 text-paper-300/70 transition-colors hover:border-white/30 hover:text-white disabled:opacity-40"
            >
              <RefreshCw size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            disabled={busy || active}
            title={active ? 'Stop processing before deleting' : 'Delete video'}
            className="inline-flex items-center justify-center rounded-full border border-white/15 p-2 text-paper-300/70 transition-colors hover:border-red-400/40 hover:text-red-200 disabled:opacity-40"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </article>
  )
}

function UploadDialog({
  onClose,
  onUpload,
}: {
  onClose: () => void
  onUpload: (files: File[], engine: Engine, precision: 'fast' | 'precise') => void
}) {
  const engine: Engine = 'api'
  const [precision, setPrecision] = useState<'fast' | 'precise'>('fast')
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const accept = (list: FileList | File[] | null) => {
    if (!list) return
    const next = Array.from(list).filter((file) => ACCEPTED.includes(file.name.split('.').pop()?.toLowerCase() ?? ''))
    setFiles((prev) => [...prev, ...next])
  }

  const submit = () => {
    if (!files.length) return
    onUpload(files, engine, precision)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="liquid-glass w-full max-w-lg rounded-2xl border border-white/10 bg-ink-900/95 p-5"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <p className="text-base font-medium text-paper-100">Add videos</p>
        <p className="mt-1 text-xs text-paper-300/50">Files are processed locally and indexed into your local vector database.</p>

        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            accept(event.dataTransfer.files)
          }}
          onClick={() => inputRef.current?.click()}
          className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-8 text-center transition-colors ${
            dragging ? 'border-glow bg-glow/10' : 'border-white/20 bg-ink-800/40 hover:border-white/40'
          }`}
        >
          <Upload size={22} className="text-glow" />
          <p className="mt-2 text-sm text-paper-100">Drop videos here or click to browse</p>
          <p className="mt-1 text-[11px] text-paper-300/45">{ACCEPTED.join(', ')}</p>
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={(event) => {
              accept(event.target.files)
              event.target.value = ''
            }}
          />
        </div>

        {files.length > 0 && (
          <ul className="mt-3 max-h-32 space-y-1 overflow-y-auto">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-lg border border-white/10 bg-ink-800/50 px-3 py-1.5 text-xs">
                <Film size={12} className="shrink-0 text-glow" />
                <span className="min-w-0 flex-1 truncate text-paper-100">{file.name}</span>
                <span className="font-mono text-[10px] text-paper-300/50">{formatBytes(file.size)}</span>
                <button type="button" className="text-paper-300/50 hover:text-white" onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4">
          <div className="flex items-start gap-2.5 rounded-xl border border-glow bg-glow/10 p-3 text-left">
            <Cpu size={15} className="mt-0.5 text-glow" />
            <span>
              <span className="block text-xs font-medium text-paper-100">Local engine</span>
              <span className="mt-0.5 block text-[10px] leading-snug text-paper-300/50">
                High-performance neural pipeline with local vector indexing.
              </span>
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-ink-800/40 px-3 py-2">
          <span className="text-xs text-paper-300/70">
            {precision === 'fast' ? 'Fast: one 10 s window per 10 s of video' : 'Precise: 10 s windows every 5 s (finer matches)'}
          </span>
          <div className="flex overflow-hidden rounded-full border border-white/15 text-[11px]">
            {(['fast', 'precise'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setPrecision(value)}
                className={`px-3 py-1 capitalize transition-colors ${precision === value ? 'bg-glow text-black' : 'text-paper-300/70 hover:text-white'}`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full border border-white/15 px-4 py-2 text-sm text-paper-300/80 hover:text-white">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!files.length}
            className="inline-flex items-center gap-1.5 rounded-full bg-glow px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Upload size={14} /> Upload {files.length > 1 ? `${files.length} videos` : ''} & process
          </button>
        </div>
      </div>
    </div>
  )
}

export function Dashboard() {
  const [jobs, setJobs] = useState<JobSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [pending, setPending] = useState<PendingUpload[]>([])
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState<JobSummary | null>(null)
  const timer = useRef<number | null>(null)

  const refresh = useCallback(async () => {
    try {
      const next = await listJobs()
      setJobs(next)
      setError(null)
    } catch (cause) {
      setError(cause instanceof JobsApiError ? cause.message : 'Could not load the library.')
    }
  }, [])

  // Poll quickly while something is processing, slowly otherwise.
  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      await refresh()
      if (cancelled) return
      const active = (jobs ?? []).some((job) => ['queued', 'running'].includes(job.status))
      timer.current = window.setTimeout(tick, active ? POLL_ACTIVE_MS : POLL_IDLE_MS)
    }
    void tick()
    return () => {
      cancelled = true
      if (timer.current) window.clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, (jobs ?? []).some((job) => ['queued', 'running'].includes(job.status))])

  const withBusy = async (id: string, action: () => Promise<unknown>) => {
    setBusyIds((prev) => new Set(prev).add(id))
    try {
      await action()
      await refresh()
    } catch (cause) {
      setError(cause instanceof JobsApiError ? cause.message : 'The action failed.')
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const handleUpload = (files: File[], engine: Engine, precision: 'fast' | 'precise') => {
    setShowUpload(false)
    for (const file of files) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setPending((prev) => [...prev, { id, name: file.name, size: file.size, fraction: 0 }])
      void (async () => {
        try {
          const job = await uploadJob(file, {
            engine,
            precision,
            onProgress: (fraction) => setPending((prev) => prev.map((item) => (item.id === id ? { ...item, fraction } : item))),
          })
          setPending((prev) => prev.filter((item) => item.id !== id))
          await refresh()
          // Jobs run one at a time on the backend; queue the rest by retrying
          // start until the slot frees up.
          for (let attempt = 0; attempt < 600; attempt += 1) {
            try {
              await startJob(job.job_id)
              break
            } catch (cause) {
              if (!(cause instanceof JobsApiError && /another processing job/i.test(cause.message))) throw cause
              await new Promise((resolve) => setTimeout(resolve, 3000))
            }
          }
          await refresh()
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : 'Upload failed'
          setPending((prev) => prev.map((item) => (item.id === id ? { ...item, error: message } : item)))
        }
      })()
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (jobs ?? []).filter((job) => {
      const status = uiStatus(job.status)
      if (filter === 'ready' && status !== 'ready') return false
      if (filter === 'processing' && !['processing', 'queued'].includes(status)) return false
      if (filter === 'unprocessed' && !['unprocessed', 'cancelled'].includes(status)) return false
      if (filter === 'failed' && status !== 'failed') return false
      if (q && !displayTitle(job).toLowerCase().includes(q) && !(job.metadata?.filename ?? '').toLowerCase().includes(q)) return false
      return true
    })
  }, [jobs, filter, query])

  const counts = useMemo(() => {
    const all = jobs ?? []
    return {
      all: all.length,
      ready: all.filter((j) => uiStatus(j.status) === 'ready').length,
      processing: all.filter((j) => ['processing', 'queued'].includes(uiStatus(j.status))).length,
      unprocessed: all.filter((j) => ['unprocessed', 'cancelled'].includes(uiStatus(j.status))).length,
      failed: all.filter((j) => uiStatus(j.status) === 'failed').length,
    }
  }, [jobs])

  return (
    <PageShell heroHeight="45vh">
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-24">
        <header className="flex flex-wrap items-end justify-between gap-4 pt-6">
          <div>
            <p className="eyebrow">Library</p>
            <h1 className="mt-2 text-4xl text-white md:text-5xl" style={{ fontFamily: "'Instrument Serif', serif" }}>
              Your videos, <span className="italic text-glow-soft">ready to ask.</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-paper-300/60">
              Every upload is kept on disk with its transcript, key moments and vectors, so a processed video stays
              searchable after a restart.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-2 rounded-full bg-glow px-5 py-2.5 text-sm font-semibold text-black shadow-glow transition-opacity hover:opacity-90"
          >
            <Plus size={16} /> Add videos
          </button>
        </header>

        <div className="mt-8 flex flex-wrap items-center gap-2">
          {(
            [
              ['all', 'All'],
              ['ready', 'Ready'],
              ['processing', 'Processing'],
              ['unprocessed', 'To process'],
              ['failed', 'Failed'],
            ] as [Filter, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                filter === value ? 'border-glow bg-glow/10 text-paper-100' : 'border-white/10 text-paper-300/70 hover:border-white/25 hover:text-white'
              }`}
            >
              {label} <span className="ml-1 font-mono text-[10px] opacity-60">{counts[value]}</span>
            </button>
          ))}
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by title…"
            className="ml-auto w-full rounded-full border border-white/10 bg-ink-900/60 px-4 py-1.5 text-xs text-paper-100 outline-none placeholder:text-paper-300/30 focus:border-white/30 sm:w-56"
          />
        </div>

        {error && (
          <p className="mt-4 flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-xs text-red-100">
            <AlertTriangle size={13} /> {error}
          </p>
        )}

        {pending.length > 0 && (
          <ul className="mt-6 space-y-2">
            {pending.map((item) => (
              <li key={item.id} className="liquid-glass flex items-center gap-3 rounded-xl border border-white/10 bg-ink-900/70 px-4 py-2.5">
                {item.error ? <AlertTriangle size={14} className="text-red-300" /> : <Loader2 size={14} className="animate-spin text-glow" />}
                <span className="min-w-0 flex-1 truncate text-xs text-paper-100">{item.name}</span>
                {item.error ? (
                  <span className="text-[11px] text-red-200">{item.error}</span>
                ) : (
                  <>
                    <span className="h-1 w-32 overflow-hidden rounded-full bg-white/10">
                      <span className="block h-full bg-glow" style={{ width: `${Math.round(item.fraction * 100)}%` }} />
                    </span>
                    <span className="font-mono text-[10px] text-paper-300/60">
                      {item.fraction >= 1 ? 'Checking file…' : `Uploading ${Math.round(item.fraction * 100)}%`}
                    </span>
                  </>
                )}
                {item.error && (
                  <button type="button" className="text-[11px] text-paper-300/50 hover:text-white" onClick={() => setPending((prev) => prev.filter((p) => p.id !== item.id))}>
                    dismiss
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {jobs === null && !error ? (
          <p className="mt-16 flex items-center justify-center gap-2 text-sm text-paper-300/50">
            <Loader2 size={14} className="animate-spin" /> Loading your library…
          </p>
        ) : visible.length === 0 ? (
          <div className="liquid-glass mt-8 rounded-2xl border border-white/10 bg-ink-900/60 px-6 py-16 text-center">
            <Film size={26} className="mx-auto text-glow" />
            <p className="mt-3 text-base text-paper-100">{jobs && jobs.length ? 'Nothing matches this filter.' : 'No videos yet.'}</p>
            <p className="mt-1 text-xs text-paper-300/50">
              {jobs && jobs.length ? 'Try another filter.' : 'Add a video to transcribe it, describe its key moments and start asking questions.'}
            </p>
            {!(jobs && jobs.length) && (
              <button type="button" onClick={() => setShowUpload(true)} className="mt-5 inline-flex items-center gap-2 rounded-full bg-glow px-5 py-2 text-sm font-medium text-black">
                <Plus size={14} /> Add your first video
              </button>
            )}
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((job) => (
              <VideoCard
                key={job.job_id}
                job={job}
                busy={busyIds.has(job.job_id)}
                onOpen={() => navigate(`/videos/${job.job_id}`)}
                onStart={() => void withBusy(job.job_id, () => startJob(job.job_id))}
                onStop={() => void withBusy(job.job_id, () => cancelJob(job.job_id))}
                onDelete={() => setConfirmDelete(job)}
              />
            ))}
          </div>
        )}
      </main>

      {showUpload && <UploadDialog onClose={() => setShowUpload(false)} onUpload={handleUpload} />}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}>
          <div className="liquid-glass w-full max-w-sm rounded-2xl border border-white/10 bg-ink-900/95 p-5" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <p className="text-base text-paper-100">Delete “{displayTitle(confirmDelete)}”?</p>
            <p className="mt-2 text-xs leading-relaxed text-paper-300/60">
              This removes the uploaded file, its transcript, key moments, chat history and its vectors from the index. It can’t be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDelete(null)} className="rounded-full border border-white/15 px-4 py-2 text-sm text-paper-300/80 hover:text-white">
                Keep
              </button>
              <button
                type="button"
                onClick={() => {
                  const job = confirmDelete
                  setConfirmDelete(null)
                  void withBusy(job.job_id, () => deleteJob(job.job_id))
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-red-400/90 px-4 py-2 text-sm font-medium text-black hover:bg-red-300"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
