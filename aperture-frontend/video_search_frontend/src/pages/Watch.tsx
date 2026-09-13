import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, ChevronDown, Cpu, Download, Eye, FileDown, Image as ImageIcon, Loader2, Play, RefreshCw, Square, Zap } from 'lucide-react'
import { PageShell } from '../components/PageShell'
import { VideoChat } from '../components/VideoChat'
import { navigate } from '../lib/router'
import {
  cancelJob,
  displayTitle,
  formatClock,
  formatSeconds,
  getJob,
  getWindows,
  jobUrls,
  momentsFromWindows,
  stageLabel,
  startJob,
  transcriptFromWindows,
  uiStatus,
  JobsApiError,
  type JobDetail,
  type WindowRow,
} from '../lib/jobs'
import { formatBytes } from '../lib/format'
import { formatElapsed, useLiveElapsed } from '../lib/useLiveElapsed'
import { clipRange, countFindings, findingsFromMessages, findingsToCsv, type FindingGroup } from '../lib/findings'
import { chatImageUrl, type ChatMessage } from '../lib/jobs'

const STAGE_ORDER = ['transcription', 'embedding_windows', 'captioning_windows', 'building_payloads', 'qdrant_upsert']

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-ink-800/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-paper-300/45">{label}</p>
      <p className="mt-0.5 truncate font-mono text-xs text-paper-100">{value}</p>
    </div>
  )
}

const VECTOR_LABELS: Record<string, string> = {
  visual: 'visual',
  audio: 'audio_event',
  speech: 'speech_text',
  caption: 'vlm_text',
}

function Chips({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-wider text-paper-300/40">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {values.map((value) => (
          <span key={value} className="rounded-full border border-white/10 bg-ink-900/60 px-2 py-0.5 text-[11px] text-paper-300/70">
            {value}
          </span>
        ))}
      </div>
    </div>
  )
}

/** One indexed window: what the pipeline saw, heard, and stored for this 10 s slice. */
function WindowCard({ row, isCurrent, onSeek }: { row: WindowRow; isCurrent: boolean; onSeek: (seconds: number) => void }) {
  const [open, setOpen] = useState(false)
  const evidence = (row.caption_evidence ?? []).filter((item) => item.trim())
  const vectors = Object.entries(row.vectors ?? {})
  const failed = (row.errors ?? []).length > 0

  return (
    <article className={`rounded-xl border bg-ink-800/40 ${isCurrent ? 'border-glow/40' : 'border-white/10'}`}>
      <div className="flex items-start gap-3 p-3">
        <button type="button" onClick={() => onSeek(row.start)} className="mt-0.5 shrink-0 rounded-md bg-glow/15 px-1.5 py-px font-mono text-[10px] text-glow-soft hover:bg-glow/25">
          {formatClock(row.start)}
        </button>
        <button type="button" onClick={() => setOpen((value) => !value)} className="min-w-0 flex-1 text-left">
          <span className={`block text-xs leading-relaxed text-paper-100/85 ${open ? '' : 'line-clamp-2'}`}>{row.caption || 'No description for this window.'}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 font-mono text-[10px] text-paper-300/40">
            <span>{row.window_id}</span>
            <span>· {(row.end - row.start).toFixed(0)}s</span>
            <span>· caption {row.provenance}</span>
            {row.has_audio ? <span>· audio</span> : <span>· silent</span>}
            {(row.sound_events?.length ?? 0) > 0 && <span className="text-glow-soft">· {row.sound_events!.length} sound{row.sound_events!.length === 1 ? '' : 's'}</span>}
            {row.indexed === false && <span className="text-amber-200/70">· not indexed</span>}
            {failed && <span className="text-red-300/80">· error</span>}
          </span>
        </button>
        <button type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? 'Collapse' : 'Expand'} className="mt-0.5 shrink-0 text-paper-300/40 hover:text-white">
          <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-white/10 p-3">
          {row.transcript && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-paper-300/40">speech</p>
              <p className="mt-1 text-xs text-paper-300/75">{row.transcript}</p>
            </div>
          )}
          <Chips label="visible details" values={evidence} />
          <Chips label="sounds heard" values={(row.sound_events ?? []).map((sound) => `${sound.label} · ${formatClock(sound.start)}`)} />
          {vectors.length > 0 && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-paper-300/40">vectors</p>
              <div className="mt-1 grid gap-1.5 sm:grid-cols-2">
                {vectors.map(([name, vector]) => (
                  <div key={name} className="rounded-lg border border-white/10 bg-ink-900/60 px-2.5 py-1.5">
                    <p className="font-mono text-[10px] text-paper-100">
                      {VECTOR_LABELS[name] ?? name}
                      <span className="text-paper-300/40"> · {vector.shape?.[0] ?? '?'}d</span>
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[9px] text-paper-300/35">
                      {vector.preview?.length ? `[${vector.preview.map((v) => v.toFixed(2)).join(', ')} …]` : `norm ${vector.norm.toFixed(2)} · min ${vector.min.toFixed(2)} · max ${vector.max.toFixed(2)}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {failed && (
            <p className="text-[11px] text-red-200/80">{row.errors?.join(' · ')}</p>
          )}
        </div>
      )}
    </article>
  )
}

function downloadText(name: string, text: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** One question's cited moments: jump, cut a clip, or save the frame. */
function ResultGroup({
  group,
  jobId,
  duration,
  current,
  onSeek,
}: {
  group: FindingGroup
  jobId: string
  duration: number
  current: number
  onSeek: (seconds: number) => void
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-ink-800/40">
      <header className="flex items-start gap-3 border-b border-white/10 px-3 py-2.5">
        {group.imageUrl && <img src={chatImageUrl(group.imageUrl)} alt="" className="h-10 w-10 shrink-0 rounded-md border border-white/10 object-cover" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-paper-100">{group.question || 'Question'}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] uppercase tracking-wider text-paper-300/45">
            {group.lookingFor && (
              <span className="inline-flex items-center gap-1 text-glow-soft">
                <ImageIcon size={10} /> {group.lookingFor}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Eye size={10} /> {group.source === 'video' ? 'watched the footage' : 'transcript & scene notes'}
            </span>
            <span>{group.findings.length} moment{group.findings.length === 1 ? '' : 's'}</span>
          </p>
        </div>
      </header>
      <ul className="divide-y divide-white/5">
        {group.findings.map((finding) => {
          const range = clipRange(finding, duration)
          const isCurrent = current >= finding.start && current < Math.max(finding.end, finding.start + 2)
          return (
            <li key={finding.id} className={`flex items-start gap-3 px-3 py-2.5 ${isCurrent ? 'bg-glow/10' : ''}`}>
              <button type="button" onClick={() => onSeek(finding.start)} className="relative shrink-0 overflow-hidden rounded-md border border-white/10 bg-black" title="Play from here">
                <img src={jobUrls.frame(jobId, finding.start)} alt="" loading="lazy" className="h-12 w-[4.5rem] object-cover" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity hover:opacity-100">
                  <Play size={14} fill="currentColor" className="text-white" />
                </span>
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <button type="button" onClick={() => onSeek(finding.start)} className="shrink-0 rounded-md bg-glow/15 px-1.5 py-px font-mono text-[11px] text-glow-soft hover:bg-glow/25">
                    {finding.label}
                  </button>
                  <p className="line-clamp-2 min-w-0 flex-1 text-xs leading-snug text-paper-100/80" title={finding.snippet}>
                    {finding.snippet || 'Cited moment'}
                  </p>
                </div>
                <div className="mt-1.5 flex items-center gap-1">
                  <span className="mr-auto text-[10px] uppercase tracking-wider text-paper-300/40">
                    {finding.kind === 'audio' ? 'heard' : finding.kind === 'transcript' ? 'speech' : 'on screen'}
                  </span>
                  <a
                    href={jobUrls.clip(jobId, range.start, range.end)}
                    className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2 py-1 text-[10px] text-paper-300/80 transition-colors hover:border-glow/50 hover:text-white"
                    title={`Download ${formatClock(range.start)}–${formatClock(range.end)} as MP4`}
                  >
                    <Download size={11} /> Clip
                  </a>
                  <a
                    href={jobUrls.frame(jobId, finding.start, true)}
                    className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2 py-1 text-[10px] text-paper-300/80 transition-colors hover:border-glow/50 hover:text-white"
                    title="Download this frame as JPEG"
                  >
                    <ImageIcon size={11} /> Frame
                  </a>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function Watch({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<JobDetail | null>(null)
  const [windows, setWindows] = useState<WindowRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'transcript' | 'moments' | 'windows' | 'details'>('transcript')
  const [sideTab, setSideTab] = useState<'chat' | 'results'>('chat')
  const [chatMessages, setChatMessages] = useState<ChatMessage[] | null>(null)
  const onChatMessages = useCallback((messages: ChatMessage[]) => setChatMessages(messages), [])
  const [current, setCurrent] = useState(0)
  const [busy, setBusy] = useState(false)
  const player = useRef<HTMLVideoElement>(null)
  const status = job ? uiStatus(job.status) : null
  const active = status === 'processing' || status === 'queued'
  const liveElapsed = useLiveElapsed(job?.elapsed_seconds, active)

  const load = useCallback(async () => {
    try {
      const next = await getJob(jobId)
      setJob(next)
      setError(null)
      if (['complete', 'completed', 'completed_with_errors', 'partial'].includes(next.status)) {
        setWindows(await getWindows(jobId))
      } else {
        setWindows([])
      }
    } catch (cause) {
      setError(cause instanceof JobsApiError ? (cause.status === 404 ? 'This video no longer exists.' : cause.message) : 'Could not load the video.')
    }
  }, [jobId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => void load(), 1500)
    return () => window.clearInterval(timer)
  }, [active, load])

  const seek = useCallback((seconds: number) => {
    const video = player.current
    if (!video) return
    video.currentTime = Math.max(0, seconds)
    void video.play().catch(() => undefined)
    video.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  const transcript = useMemo(() => transcriptFromWindows(windows), [windows])
  const moments = useMemo(() => momentsFromWindows(windows), [windows])
  const results = useMemo(() => findingsFromMessages(chatMessages ?? []), [chatMessages])
  const resultCount = countFindings(results)

  // A fresh answer with cited moments pulls the Results tab forward, so the
  // eye lands on the evidence right after the question is answered.  The
  // history that loads with the page does not count as fresh.
  const lastResultId = results[0]?.id
  const seenResultId = useRef<string | undefined>(undefined)
  const chatPrimed = useRef(false)
  // "New" dot on the Results tab until it is opened.
  const [freshResults, setFreshResults] = useState(false)
  useEffect(() => {
    if (chatMessages === null) return
    if (!chatPrimed.current) {
      chatPrimed.current = true
      seenResultId.current = lastResultId
      return
    }
    if (lastResultId && lastResultId !== seenResultId.current) {
      seenResultId.current = lastResultId
      setFreshResults(true)
    }
  }, [chatMessages, lastResultId])
  useEffect(() => {
    if (sideTab === 'results') setFreshResults(false)
  }, [sideTab, resultCount])
  const activeTranscript = transcript.findIndex((row) => current >= row.start && current < row.end)

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await action()
      await load()
    } catch (cause) {
      setError(cause instanceof JobsApiError ? cause.message : 'The action failed.')
    } finally {
      setBusy(false)
    }
  }

  const m = job?.metadata ?? {}
  const durations = job?.summary?.stage_durations ?? {}
  const percent = job ? Math.round(Math.max(0, Math.min(1, job.progress)) * 100) : 0

  return (
    <PageShell heroHeight="30vh">
      <main className="mx-auto w-full max-w-7xl flex-1 px-5 pb-20">
        <button type="button" onClick={() => navigate('/dashboard')} className="mt-2 inline-flex items-center gap-1.5 text-xs text-paper-300/60 transition-colors hover:text-white">
          <ArrowLeft size={13} /> Library
        </button>

        {error && (
          <p className="mt-4 flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-xs text-red-100">
            <AlertTriangle size={13} /> {error}
          </p>
        )}

        {!job && !error && (
          <p className="mt-16 flex items-center justify-center gap-2 text-sm text-paper-300/50">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </p>
        )}

        {job && (
          <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            {/* Player column */}
            <div className="min-w-0">
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-glow">
                <video
                  ref={player}
                  src={jobUrls.video(job.job_id)}
                  poster={jobUrls.thumbnail(job.job_id)}
                  controls
                  playsInline
                  preload="metadata"
                  className="aspect-video w-full bg-black"
                  onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
                />
              </div>

              <h1 className="mt-4 text-2xl text-white md:text-3xl" style={{ fontFamily: "'Instrument Serif', serif" }}>
                {displayTitle(job)}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-paper-300/55">
                <span>{formatClock(m.duration ?? 0)}</span>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <Cpu size={12} />
                  Local engine
                </span>
                <span aria-hidden>·</span>
                <span>{m.filename}</span>
                <span className="ml-auto flex items-center gap-2">
                  {active ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void run(() => cancelJob(job.job_id))}
                      className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-300/10 disabled:opacity-40"
                    >
                      <Square size={11} fill="currentColor" /> Stop processing
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void run(() => startJob(job.job_id))}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs disabled:opacity-40 ${
                        status === 'ready' ? 'border border-white/15 text-paper-300/80 hover:text-white' : 'bg-glow font-medium text-black hover:opacity-90'
                      }`}
                    >
                      {status === 'ready' ? <RefreshCw size={11} /> : <Zap size={11} />}
                      {status === 'ready' ? 'Process again' : status === 'unprocessed' ? 'Process now' : 'Retry processing'}
                    </button>
                  )}
                </span>
              </div>

              {active && (
                <div className="mt-4 rounded-xl border border-glow/20 bg-glow/5 px-4 py-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-2 text-glow-soft">
                      <Loader2 size={12} className="animate-spin" /> {stageLabel(job.stage)}
                    </span>
                    <span className="font-mono text-paper-300/70">
                      {percent}% · {formatElapsed(liveElapsed)}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-glow transition-[width] duration-700" style={{ width: `${percent}%` }} />
                  </div>
                  {job.activity.length > 0 && (
                    <p className="mt-2 truncate font-mono text-[10px] text-paper-300/50">{job.activity[job.activity.length - 1].message}</p>
                  )}
                </div>
              )}

              {status === 'failed' && job.errors[0]?.message && (
                <p className="mt-4 flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-xs leading-relaxed text-red-100">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {job.errors[0].message}
                </p>
              )}

              <div className="mt-5 flex gap-1 border-b border-white/10">
                {(
                  [
                    ['transcript', `Transcript${transcript.length ? ` · ${transcript.length}` : ''}`],
                    ['moments', `Key moments${moments.length ? ` · ${moments.length}` : ''}`],
                    ['windows', `Windows${windows.length ? ` · ${windows.length}` : ''}`],
                    ['details', 'Details'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTab(value)}
                    className={`-mb-px border-b-2 px-3 py-2 text-xs transition-colors ${
                      tab === value ? 'border-glow text-paper-100' : 'border-transparent text-paper-300/60 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === 'transcript' && (
                <div className="mt-3 max-h-[28rem] space-y-1 overflow-y-auto pr-1">
                  {transcript.length === 0 ? (
                    <p className="px-2 py-6 text-center text-xs text-paper-300/50">
                      {status === 'ready' ? 'No speech was detected in this video.' : 'The transcript appears here once processing finishes.'}
                    </p>
                  ) : (
                    transcript.map((row, index) => (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => seek(row.start)}
                        className={`flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/5 ${
                          index === activeTranscript ? 'bg-glow/10' : ''
                        }`}
                      >
                        <span className="mt-0.5 shrink-0 font-mono text-[11px] text-glow">{formatClock(row.start)}</span>
                        <span className="text-[13px] leading-relaxed text-paper-100/85">{row.text}</span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {tab === 'moments' && (
                <div className="mt-3 grid max-h-[28rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {moments.length === 0 ? (
                    <p className="col-span-full px-2 py-6 text-center text-xs text-paper-300/50">
                      {status === 'ready' ? 'No scene descriptions were produced.' : 'Key moments appear here once processing finishes.'}
                    </p>
                  ) : (
                    moments.map((moment) => (
                      <button
                        key={moment.id}
                        type="button"
                        onClick={() => seek(moment.start)}
                        className="flex items-start gap-3 rounded-xl border border-white/10 bg-ink-800/40 p-3 text-left transition-colors hover:border-glow/40"
                      >
                        <span className="shrink-0 rounded-md bg-glow/15 px-1.5 py-px font-mono text-[10px] text-glow-soft">{formatClock(moment.start)}</span>
                        <span className="min-w-0">
                          <span className="line-clamp-3 text-xs leading-relaxed text-paper-100/85">{moment.caption}</span>
                          <span className="mt-1 block text-[10px] text-paper-300/40">confidence {Math.round(moment.confidence * 100)}%</span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {tab === 'windows' && (
                <div className="mt-3 max-h-[32rem] space-y-2 overflow-y-auto pr-1">
                  {windows.length === 0 ? (
                    <p className="px-2 py-6 text-center text-xs text-paper-300/50">
                      {status === 'ready' ? 'No windows were indexed for this video.' : 'Per-window details appear here once processing finishes.'}
                    </p>
                  ) : (
                    [...windows]
                      .sort((a, b) => a.index - b.index)
                      .map((row) => <WindowCard key={row.window_id} row={row} isCurrent={current >= row.start && current < row.end} onSeek={seek} />)
                  )}
                </div>
              )}

              {tab === 'details' && (
                <div className="mt-3 space-y-4">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Meta label="Upload time" value={formatSeconds(m.upload_seconds)} />
                    <Meta label="Processing time" value={status === 'unprocessed' ? '—' : formatSeconds(job.summary?.elapsed_seconds ?? job.elapsed_seconds)} />
                    <Meta label="Indexed" value={status === 'ready' ? `${job.summary?.successfully_indexed_windows ?? 0}/${job.total_windows} windows` : '—'} />
                    <Meta label="Resolution" value={m.width && m.height ? `${m.width}×${m.height} · ${Math.round(m.fps ?? 0)} fps` : '—'} />
                    <Meta label="File" value={`${(m.container ?? '').split(',')[0] || '—'} · ${m.size_bytes ? formatBytes(m.size_bytes) : '—'}`} />
                    <Meta label="Audio" value={m.has_audio ? 'yes' : 'no audio track'} />
                  </div>
                  {Object.keys(durations).length > 0 && (
                    <div className="rounded-xl border border-white/10 bg-ink-800/40 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-paper-300/45">Where the processing time went</p>
                      <ul className="mt-2 space-y-1.5">
                        {[...STAGE_ORDER.filter((s) => s in durations), ...Object.keys(durations).filter((s) => !STAGE_ORDER.includes(s))].map((stage) => {
                          const total = Object.values(durations).reduce((sum, v) => sum + v, 0) || 1
                          return (
                            <li key={stage} className="flex items-center gap-3 text-xs">
                              <span className="w-44 shrink-0 truncate text-paper-300/70">{stageLabel(stage)}</span>
                              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                                <span className="block h-full bg-glow/70" style={{ width: `${Math.max(2, (durations[stage] / total) * 100)}%` }} />
                              </span>
                              <span className="w-16 shrink-0 text-right font-mono text-[11px] text-paper-100">{formatSeconds(durations[stage])}</span>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Chat column: the conversation and, one tab over, every moment it cited */}
            <aside className="flex flex-col lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:self-start">
              <div className="mb-2 flex gap-1 rounded-full border border-white/10 bg-ink-900/70 p-1 text-xs">
                {(
                  [
                    ['chat', 'Ask this video', 0],
                    ['results', 'Results', resultCount],
                  ] as const
                ).map(([value, label, count]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSideTab(value)}
                    className={`relative flex-1 rounded-full px-3 py-1.5 transition-colors ${
                      sideTab === value ? 'bg-glow text-black' : 'text-paper-300/70 hover:text-white'
                    }`}
                  >
                    {label}
                    {count > 0 && <span className="ml-1.5 font-mono text-[10px] opacity-80">{count}</span>}
                    {value === 'results' && freshResults && sideTab !== 'results' && (
                      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-glow" aria-label="New results" />
                    )}
                  </button>
                ))}
              </div>
              {/* Both stay mounted so switching tabs never loses a half-typed question.
                  Toggled with the `hidden` class (not the attribute): Tailwind's `flex`
                  utility would otherwise override the attribute and show both at once. */}
              <div className={sideTab === 'chat' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
                <VideoChat jobId={job.job_id} ready={status === 'ready'} onSeek={seek} onMessages={onChatMessages} />
              </div>
              <section className={sideTab === 'results' ? 'liquid-glass flex min-h-0 flex-1 flex-col rounded-2xl border border-white/10 bg-ink-900/70' : 'hidden'}>
                <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <p className="text-xs text-paper-300/60">
                    {resultCount ? `${resultCount} cited moment${resultCount === 1 ? '' : 's'} · ${results.length} question${results.length === 1 ? '' : 's'}` : 'Cited moments'}
                  </p>
                  {resultCount > 0 && (
                    <button
                      type="button"
                      onClick={() => downloadText(`${displayTitle(job).replace(/[^\w-]+/g, '_')}_results.csv`, findingsToCsv(displayTitle(job), results))}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-[11px] text-paper-300/80 transition-colors hover:border-glow/50 hover:text-white"
                    >
                      <FileDown size={12} /> Export CSV
                    </button>
                  )}
                </header>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
                  {results.length === 0 ? (
                    <p className="rounded-xl border border-white/10 bg-ink-800/50 px-3 py-3 text-xs leading-relaxed text-paper-300/60">
                      Ask a question — every moment the answer cites is collected here with a clip and a frame you can download.
                    </p>
                  ) : (
                    results.map((group) => (
                      <ResultGroup key={group.id} group={group} jobId={job.job_id} duration={m.duration ?? 0} current={current} onSeek={seek} />
                    ))
                  )}
                </div>
              </section>
            </aside>
          </div>
        )}
      </main>
    </PageShell>
  )
}
