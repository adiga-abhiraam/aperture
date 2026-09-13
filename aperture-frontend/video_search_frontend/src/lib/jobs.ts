// Client for the processing-job API that backs the Dashboard and Watch pages.
//
// A "video" in the UI is a processing job on the backend: the upload lives in
// processing_jobs/<job_id>/ with its job.json and exported windows, so the
// library survives a backend restart. Vectors live in Qdrant.
import { API_BASE_URL } from './api'

export type JobStatus =
  | 'created'
  | 'queued'
  | 'running'
  | 'complete'
  | 'completed'
  | 'completed_with_errors'
  | 'partial'
  | 'failed'
  | 'cancelled'

export type Engine = 'api' | 'local'

export const API_PROFILE_ID = 'api-gemini-free-v1'
export const LOCAL_PROFILE_ID = 'self-hosted-v1'

export interface JobMetadata {
  filename?: string
  video_id?: string
  duration?: number
  width?: number
  height?: number
  fps?: number
  container?: string
  codec?: string
  has_audio?: boolean
  size_bytes?: number
  upload_seconds?: number
}

export interface JobSummary {
  job_id: string
  title: string
  status: JobStatus
  stage: string
  progress: number
  profile_id: string
  created_at: number
  started_at: number | null
  finished_at: number | null
  metadata: JobMetadata
  total_windows: number
  indexed_windows: number
  processing_seconds: number | null
  stage_durations: Record<string, number>
  errors: { message: string }[]
}

export interface JobDetail extends Omit<JobSummary, 'indexed_windows' | 'processing_seconds' | 'stage_durations'> {
  current_window: number
  elapsed_seconds: number
  configuration: Record<string, unknown>
  summary: {
    status?: string
    successfully_indexed_windows?: number
    failed_windows?: number
    elapsed_seconds?: number
    stage_durations?: Record<string, number>
    provider_calls?: Record<string, number>
  }
  activity: { message: string; stage?: string; level?: string; timestamp?: number }[]
}

export interface VectorSummary {
  shape: number[]
  norm: number
  min: number
  max: number
  finite: boolean
  /** First few components of the stored embedding. */
  preview?: number[]
}

export interface WindowRow {
  index: number
  window_id: string
  start: number
  end: number
  transcript: string
  caption: string
  /** Short noun/verb phrases the captioner flagged as the most specific visible details. */
  caption_evidence?: string[]
  /** Non-speech sounds heard in this window (siren, horn, ...) with exact seconds. */
  sound_events?: { label: string; start: number; end: number; confidence: number }[]
  provenance: 'direct' | 'inherited' | 'unavailable'
  confidence: number
  has_audio: boolean
  selected: boolean
  indexed?: boolean
  vectors?: Record<string, VectorSummary>
  errors?: string[]
}

export interface ChatCitation {
  window_id: string
  window_index: number
  start: number
  end: number
  label: string
  snippet: string
  kind: 'transcript' | 'visual' | 'audio'
}

/** What the model saw in an attached reference photo. */
export interface ChatReference {
  subject: string
  description: string
  distinguishing_marks: string[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at?: number
  /** Server path of the reference photo on a user turn (relative to the API base). */
  image_url?: string
  /** Browser-only preview while the message is still being answered. */
  image_preview?: string
  reference?: ChatReference | null
  citations?: ChatCitation[]
  found_in_video?: boolean
  /** "video" when the transcript couldn't answer and the model watched the footage. */
  source?: 'transcript' | 'video'
  model?: string
  elapsed_seconds?: number
  pending?: boolean
  error?: boolean
}

export class JobsApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}${path}`, init)
  } catch {
    throw new JobsApiError(`Could not reach the API at ${API_BASE_URL}. Is the backend running?`, 0)
  }
  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = typeof body.detail === 'string' ? body.detail : body?.error?.message
    throw new JobsApiError(detail || `Request failed (${res.status})`, res.status)
  }
  return body as T
}

export const jobUrls = {
  thumbnail: (id: string) => `${API_BASE_URL}/api/processing/jobs/${id}/thumbnail`,
  video: (id: string) => `${API_BASE_URL}/api/processing/jobs/${id}/video`,
  /** A small frame at a whole second — the cited moment itself. */
  frame: (id: string, seconds: number, download = false) =>
    `${API_BASE_URL}/api/processing/jobs/${id}/frame/${Math.max(0, Math.floor(seconds))}${download ? '?download=1' : ''}`,
  /** A downloadable MP4 cut of start–end (re-encoded, exact to the second). */
  clip: (id: string, start: number, end: number) =>
    `${API_BASE_URL}/api/processing/jobs/${id}/clip?start=${Math.max(0, start)}&end=${end}`,
}

export function listJobs(): Promise<JobSummary[]> {
  return request<{ jobs: JobSummary[] }>('/api/processing/jobs').then((body) => body.jobs)
}

export function getJob(id: string): Promise<JobDetail> {
  return request<JobDetail>(`/api/processing/jobs/${id}`)
}

export function getWindows(id: string): Promise<WindowRow[]> {
  return request<{ windows: WindowRow[] }>(`/api/processing/jobs/${id}/windows`).then((b) => b.windows)
}

export function startJob(id: string): Promise<void> {
  return request(`/api/processing/jobs/${id}/start`, { method: 'POST' })
}

export function cancelJob(id: string): Promise<void> {
  return request(`/api/processing/jobs/${id}/cancel`, { method: 'POST' })
}

export function deleteJob(id: string): Promise<{ deleted: string; index_cleared: boolean | null }> {
  return request(`/api/processing/jobs/${id}`, { method: 'DELETE' })
}

export function getChat(id: string): Promise<ChatMessage[]> {
  return request<{ messages: ChatMessage[] }>(`/api/processing/jobs/${id}/chat`).then((b) => b.messages)
}

/**
 * Ask one question; an optional reference photo ("find this bottle / car /
 * person") is described by the model first, then matched against the footage.
 */
export function askVideo(id: string, question: string, image?: File | null): Promise<ChatMessage> {
  const body = new FormData()
  body.append('question', question)
  if (image) body.append('image', image, image.name || 'reference.jpg')
  return request<{ message: ChatMessage }>(`/api/processing/jobs/${id}/chat/ask`, { method: 'POST', body })
    .then((b) => b.message)
    .catch((cause) => {
      // A 404 here is the route, not the job: the API process predates this feature.
      if (cause instanceof JobsApiError && cause.status === 404) {
        throw new JobsApiError('The backend is running an older build without photo chat. Restart the backend server and try again.', 404)
      }
      throw cause
    })
}

export function chatImageUrl(path: string): string {
  return path.startsWith('http') || path.startsWith('blob:') ? path : `${API_BASE_URL}${path}`
}

/**
 * Upload the video to the chat model ahead of the first question. Best effort:
 * the backend answers immediately and uploads in the background.
 */
export function warmChat(id: string): Promise<void> {
  return request(`/api/processing/jobs/${id}/chat/warm`, { method: 'POST' }).then(() => undefined)
}

export function clearChat(id: string): Promise<void> {
  return request(`/api/processing/jobs/${id}/chat`, { method: 'DELETE' })
}

export interface UploadOptions {
  title?: string
  engine: Engine
  /** Fast = 10 s windows tiled (18 per 3 min); precise = 5 s stride (twice the calls). */
  precision: 'fast' | 'precise'
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}

/**
 * Upload one file as a new job. The `X-Upload-Started-Ms` header lets the
 * backend record how long the upload took next to the processing time.
 */
export function uploadJob(file: File, options: UploadOptions): Promise<JobDetail> {
  const configuration: Record<string, unknown> = { index_qdrant: true }
  if (options.title?.trim()) configuration.title = options.title.trim()
  // 10 s windows for both engines: one description + one set of vectors per
  // 10 s of footage. Fast tiles the video (no overlap); Precise overlaps by
  // half so a moment that straddles a boundary is still matched.
  configuration.window_seconds = 10
  configuration.stride_seconds = options.precision === 'fast' ? 10 : 5
  if (options.engine === 'api') configuration.profile_id = API_PROFILE_ID

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE_URL}/api/processing/jobs`)
    xhr.setRequestHeader('X-Upload-Started-Ms', String(Date.now()))
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(event.loaded / event.total)
    }
    xhr.onabort = () => reject(new DOMException('Upload aborted', 'AbortError'))
    xhr.onerror = () => reject(new JobsApiError('Upload failed. Is the backend running?', 0))
    xhr.onload = () => {
      let body: { job_id?: string; detail?: string } = {}
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        // handled below
      }
      if (xhr.status !== 201 || !body.job_id) {
        reject(new JobsApiError(body.detail ?? `Upload failed (${xhr.status})`, xhr.status))
        return
      }
      resolve(body as unknown as JobDetail)
    }
    options.signal?.addEventListener('abort', () => xhr.abort())
    const form = new FormData()
    form.append('video', file)
    form.append('configuration', JSON.stringify(configuration))
    xhr.send(form)
  })
}

// ---- Status helpers shared by the dashboard and the watch page ----

export type UiStatus = 'ready' | 'processing' | 'queued' | 'unprocessed' | 'failed' | 'cancelled'

export function uiStatus(status: JobStatus): UiStatus {
  switch (status) {
    case 'created':
      return 'unprocessed'
    case 'queued':
      return 'queued'
    case 'running':
      return 'processing'
    case 'complete':
    case 'completed':
    case 'completed_with_errors':
    case 'partial':
      return 'ready'
    case 'cancelled':
      return 'cancelled'
    default:
      return 'failed'
  }
}

export const STAGE_LABELS: Record<string, string> = {
  validated: 'Ready to process',
  queued: 'Queued',
  configuration: 'Preparing',
  validation: 'Checking the file',
  windowing: 'Splitting into windows',
  ffprobe_validation: 'Checking the file',
  model_processing: 'Loading models',
  transcription: 'Transcribing speech',
  qdrant_schema: 'Preparing the index',
  embedding_windows: 'Embedding frames & audio',
  bucket: 'Embedding frames & audio',
  selecting_windows: 'Choosing key moments',
  captioning_windows: 'Describing key moments',
  openai_vlm: 'Describing key moments',
  local_qwen_vlm: 'Describing key moments',
  building_payloads: 'Building the index',
  writing_qdrant: 'Writing to the index',
  qdrant_upsert: 'Writing to the index',
  complete: 'Done',
  completed: 'Done',
  failed: 'Failed',
  cancelled: 'Stopped',
  interrupted: 'Interrupted by a restart',
}

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage.replace(/_/g, ' ')
}

export function formatSeconds(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (value < 1) return `${Math.round(value * 1000)} ms`
  if (value < 60) return `${value.toFixed(value < 10 ? 1 : 0)} s`
  const minutes = Math.floor(value / 60)
  const seconds = Math.round(value % 60)
  if (minutes < 60) return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${(minutes % 60).toString().padStart(2, '0')}m`
}

export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function formatRelative(epochSeconds: number): string {
  const delta = Date.now() / 1000 - epochSeconds
  if (delta < 60) return 'just now'
  if (delta < 3600) return `${Math.floor(delta / 60)} min ago`
  if (delta < 86400) return `${Math.floor(delta / 3600)} h ago`
  if (delta < 86400 * 7) return `${Math.floor(delta / 86400)} d ago`
  return new Date(epochSeconds * 1000).toLocaleDateString()
}

/** "Two_cats_dancing_202608162154.mp4" -> "Two cats dancing" */
export function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.[^/.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s*\b\d{10,}\b\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function displayTitle(job: Pick<JobSummary, 'title' | 'job_id' | 'metadata'>): string {
  const filename = job.metadata?.filename ?? ''
  if (job.title && job.title !== filename) return job.title
  return titleFromFilename(filename) || job.job_id
}

/**
 * Overlapping windows repeat text. Keep the even-indexed windows (a clean
 * tiling) plus any odd window that adds words the previous one didn't.
 */
export function transcriptFromWindows(windows: WindowRow[]): { id: string; start: number; end: number; text: string }[] {
  const sorted = [...windows].sort((a, b) => a.index - b.index)
  const out: { id: string; start: number; end: number; text: string }[] = []
  let last = ''
  for (const w of sorted) {
    const text = (w.transcript || '').trim()
    if (!text) continue
    if (w.index % 2 === 0 || (!last.includes(text) && !text.includes(last))) {
      out.push({ id: w.window_id, start: w.start, end: w.end, text })
      last = text
    }
  }
  return out
}

export function momentsFromWindows(windows: WindowRow[]): { id: string; start: number; end: number; caption: string; confidence: number }[] {
  return windows
    .filter((w) => w.provenance === 'direct' && w.caption && w.caption !== '[CAPTION UNAVAILABLE]')
    .sort((a, b) => a.start - b.start)
    .map((w) => ({ id: w.window_id, start: w.start, end: w.end, caption: w.caption, confidence: w.confidence }))
}
