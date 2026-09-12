/** Wire types for the processing/query API. Mirrors aperture-backend. */

export type JobStatus =
  | "created"
  | "queued"
  | "running"
  | "complete"
  | "completed_with_errors"
  | "partial"
  | "failed"
  | "cancelled";

export interface JobMetadata {
  video_id?: string;
  filename?: string;
  duration?: number;
  has_video?: boolean;
  has_audio?: boolean;
  fps?: number;
  width?: number;
  height?: number;
  codec?: string;
  container?: string;
}

export interface JobError {
  window_id?: string;
  message: string;
}

/** Row from GET /api/processing/jobs */
export interface JobSummary {
  job_id: string;
  title: string;
  status: JobStatus;
  stage: string;
  progress: number; // 0..1
  created_at: number; // unix seconds
  started_at: number | null;
  finished_at: number | null;
  metadata: JobMetadata;
  total_windows: number;
  indexed_windows: number;
  errors: JobError[];
}

/** GET /api/processing/jobs/{id} adds diagnostics; we only rely on these. */
export interface JobPublic extends Omit<JobSummary, "total_windows" | "indexed_windows" | "errors"> {
  current_window: number;
  total_windows: number;
  summary: { successfully_indexed_windows?: number; status?: string; duration?: number };
  errors: JobError[];
}

/** One 10-second analysis window, from GET /api/processing/jobs/{id}/windows */
export interface WindowRow {
  index: number;
  video_id: string;
  window_id: string;
  start: number;
  end: number;
  transcript: string;
  caption: string;
  provenance: "direct" | "inherited" | "unavailable";
  confidence: number;
  vlm_call_state: string;
  indexed: boolean;
}

export interface SearchResultItem {
  video_id: string;
  window_id: string;
  start: number;
  end: number;
  transcript: string;
  caption: string;
  score: number;
  matched_modalities: string[];
  state: "retrieved" | "verified" | "rejected" | "verification_unavailable";
  refined_start?: number | null;
  refined_end?: number | null;
  verification?: { evidence?: string; reason?: string; confidence?: number | null } | null;
}

export interface SearchResponse {
  results: SearchResultItem[];
  diagnostics?: Record<string, unknown>;
}
