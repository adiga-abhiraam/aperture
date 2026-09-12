/**
 * Translate backend job records into the UI's Video model.
 *
 * Kept pure (no fetch) so it is easy to unit test and so the same mapping
 * serves both the listing (JobSummary) and the detail page (JobPublic).
 */
import { ProcessingStatus, TranscriptSegment, Video, VideoProcessingDetails, VisualDetection } from "@/types/video";
import { apiUrl } from "./client";
import { JobPublic, JobStatus, JobSummary, WindowRow } from "./types";

export function statusFromJob(status: JobStatus): ProcessingStatus {
  switch (status) {
    case "created":
      return "not_processed";
    case "queued":
    case "running":
      return "processing";
    case "complete":
    case "completed_with_errors":
    case "partial":
      return "preprocessed";
    default:
      return "failed";
  }
}

// Pipeline stages grouped into five user-facing steps. Order matters: the
// job's current `stage` locates the in-progress step.
const STEPS: { name: string; description: string; stages: string[] }[] = [
  { name: "Check the upload", description: "Read the container, codec and duration", stages: ["validated", "configuration", "queued", "ffprobe_validation", "model_processing"] },
  { name: "Transcribe speech", description: "Whisper speech-to-text with timestamps", stages: ["transcription"] },
  { name: "Index frames and audio", description: "Visual and audio embeddings for every 10-second window", stages: ["qdrant_schema", "embedding_windows", "bucket"] },
  { name: "Describe key moments", description: "Caption the windows where the scene changes", stages: ["selecting_windows", "captioning_windows", "openai_vlm", "local_qwen_vlm", "cosmos_vlm", "mock_vlm"] },
  { name: "Write to the search index", description: "Store every window in the vector database", stages: ["building_payloads", "writing_qdrant", "qdrant_upsert"] },
];

export function processingDetailsFromJob(job: Pick<JobSummary, "status" | "stage" | "progress" | "errors" | "started_at" | "finished_at">): VideoProcessingDetails {
  const status = statusFromJob(job.status);
  const done = status === "preprocessed";
  const failed = status === "failed";
  let current = STEPS.findIndex((s) => s.stages.includes(job.stage));
  if (done) current = STEPS.length;
  if (current < 0) current = failed ? STEPS.length - 1 : 0;

  return {
    status,
    progressPercent: done ? 100 : Math.round(Math.max(0, Math.min(1, job.progress)) * 100),
    currentStep: STEPS[Math.min(current, STEPS.length - 1)]?.name,
    startedAt: job.started_at ? new Date(job.started_at * 1000).toISOString() : undefined,
    completedAt: job.finished_at ? new Date(job.finished_at * 1000).toISOString() : undefined,
    error: failed ? job.errors[0]?.message : undefined,
    steps: STEPS.map((step, i) => ({
      name: step.name,
      description: step.description,
      status: i < current ? "completed" : i === current ? (failed ? "failed" : status === "processing" ? "in_progress" : "pending") : "pending",
    })),
  };
}

/**
 * Windows are 10 s long with a 5 s stride, so neighbours overlap and repeat
 * text. Keep the even-indexed windows (a clean tiling) plus any odd window
 * that adds words the previous one didn't have.
 */
export function transcriptFromWindows(windows: WindowRow[]): TranscriptSegment[] {
  const sorted = [...windows].sort((a, b) => a.index - b.index);
  const out: TranscriptSegment[] = [];
  let lastText = "";
  for (const w of sorted) {
    const text = (w.transcript || "").trim();
    if (!text) continue;
    const isTile = w.index % 2 === 0;
    const isNew = !lastText.includes(text) && !text.includes(lastText);
    if (isTile || isNew) {
      out.push({ id: w.window_id, start: w.start, end: w.end, text });
      lastText = text;
    }
  }
  return out;
}

export function detectionsFromWindows(windows: WindowRow[]): VisualDetection[] {
  return windows
    .filter((w) => w.provenance === "direct" && w.caption && w.caption !== "[CAPTION UNAVAILABLE]")
    .sort((a, b) => a.start - b.start)
    .map((w) => {
      const firstSentence = w.caption.split(/(?<=[.!?])\s/)[0] || w.caption;
      return {
        id: w.window_id,
        timestamp: w.start,
        label: firstSentence.length > 72 ? `${firstSentence.slice(0, 69)}…` : firstSentence,
        confidence: w.confidence,
        category: "scene",
        description: w.caption,
      };
    });
}

/** "Two_cats_dancing_on_beach_202608162154.mp4" -> "Two cats dancing on beach" */
export function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.[^/.]+$/, "")
    .replace(/[_\-]+/g, " ")
    .replace(/\s*\b\d{10,}\b\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function videoFromJob(job: JobSummary | JobPublic, windows: WindowRow[] = []): Video {
  const m = job.metadata || {};
  const indexed = "indexed_windows" in job ? job.indexed_windows : job.summary?.successfully_indexed_windows ?? 0;
  const status = statusFromJob(job.status);
  const filename = m.filename || "";

  return {
    id: job.job_id,
    indexVideoId: m.video_id,
    title: job.title && job.title !== filename ? job.title : titleFromFilename(filename) || job.job_id,
    description:
      status === "preprocessed"
        ? `${filename} · ${indexed} indexed segments. Ask about what is said or shown, or search the transcript.`
        : status === "processing"
          ? `${filename} · processing now. Transcript and visual moments appear here when it finishes.`
          : `${filename} · not processed yet. Start processing to enable search and chat.`,
    thumbnailUrl: apiUrl(`/api/processing/jobs/${job.job_id}/thumbnail`),
    videoUrl: apiUrl(`/api/processing/jobs/${job.job_id}/video`),
    duration: m.duration ?? 0,
    uploadedAt: new Date((job.created_at || 0) * 1000).toISOString(),
    status,
    processingDetails: processingDetailsFromJob({ ...job, errors: job.errors || [] }),
    metadata: {
      resolution: m.width && m.height ? `${m.width}×${m.height}` : "—",
      fps: Math.round(m.fps || 0),
      fileSize: "—",
      format: (m.container || "").split(",")[0].toUpperCase() || "—",
      vectorCount: indexed,
      embeddingModels: { audio: "Whisper", visual: "X-CLIP ViT-B/32 + CLAP", text: "BGE-M3" },
    },
    category: "",
    tags: [],
    queryCount: 0,
    transcripts: transcriptFromWindows(windows),
    visualDetections: detectionsFromWindows(windows),
    suggestedQuestions: [],
  };
}
