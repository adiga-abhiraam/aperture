/**
 * Video library backed by the processing API.
 *
 * Every "video" is one processing job: the upload lives in the job folder,
 * processing produces the transcript/embeddings, and the finished windows
 * are what search and chat run over.
 */
import { Video } from "@/types/video";
import { api, apiUrl } from "./api/client";
import { videoFromJob } from "./api/adapters";
import { JobPublic, JobSummary, WindowRow } from "./api/types";
import { mockVideoService } from "./mockVideoService";

export interface UploadOptions {
  title: string;
  startProcessing: boolean;
}

export interface VideoService {
  list(): Promise<Video[]>;
  /** Full record including transcript and visual moments; null when unknown. */
  get(id: string): Promise<Video | null>;
  upload(file: Blob, filename: string, options: UploadOptions): Promise<Video>;
  startProcessing(id: string): Promise<Video>;
  /** Removes the upload, its exports and its rows in the search index. */
  delete(id: string): Promise<void>;
}

// Pipeline mode for new uploads. "selection_only" needs no API key: speech is
// transcribed and every window is embedded/indexed, captions are skipped.
const VLM_MODE = process.env.NEXT_PUBLIC_VLM_MODE || "selection_only";

class ApiVideoService implements VideoService {
  async list(): Promise<Video[]> {
    const { jobs } = await api<{ jobs: JobSummary[] }>("/api/processing/jobs");
    return jobs.map((job) => videoFromJob(job));
  }

  async get(id: string): Promise<Video | null> {
    let job: JobPublic;
    try {
      job = await api<JobPublic>(`/api/processing/jobs/${encodeURIComponent(id)}`);
    } catch (err) {
      if (err instanceof Error && "status" in err && (err as { status: number }).status === 404) return null;
      throw err;
    }
    let windows: WindowRow[] = [];
    if (job.status !== "created" && job.status !== "queued" && job.status !== "running") {
      const res = await api<{ windows: WindowRow[] }>(`/api/processing/jobs/${encodeURIComponent(id)}/windows`);
      windows = res.windows;
    }
    return videoFromJob(job, windows);
  }

  async upload(file: Blob, filename: string, options: UploadOptions): Promise<Video> {
    const form = new FormData();
    form.append("video", file, filename);
    form.append(
      "configuration",
      JSON.stringify({ title: options.title, vlm_mode: VLM_MODE, index_qdrant: true, profile_id: "self-hosted-v1" })
    );
    const job = await api<JobPublic>("/api/processing/jobs", { method: "POST", body: form });
    const video = videoFromJob(job);
    return options.startProcessing ? this.startProcessing(video.id) : video;
  }

  async startProcessing(id: string): Promise<Video> {
    const job = await api<JobPublic>(`/api/processing/jobs/${encodeURIComponent(id)}/start`, { method: "POST" });
    return videoFromJob(job);
  }

  async delete(id: string): Promise<void> {
    await api<{ deleted: string }>(`/api/processing/jobs/${encodeURIComponent(id)}`, { method: "DELETE" });
  }
}

/** The original browser-only mock, behind the same interface (NEXT_PUBLIC_USE_MOCK=1). */
class MockVideoServiceAdapter implements VideoService {
  async list() {
    return mockVideoService.getAllVideos();
  }
  async get(id: string) {
    return mockVideoService.getVideoById(id) ?? null;
  }
  async upload(file: Blob, filename: string, options: UploadOptions) {
    return mockVideoService.addUploadedVideo({
      title: options.title,
      videoUrl: URL.createObjectURL(file),
      startProcessingImmediately: options.startProcessing,
    });
  }
  async startProcessing(id: string) {
    void mockVideoService.triggerProcessing(id);
    return mockVideoService.getVideoById(id)!;
  }
  async delete(id: string) {
    mockVideoService.deleteVideo(id);
  }
}

export const USING_MOCK_API = process.env.NEXT_PUBLIC_USE_MOCK === "1";
export const videoService: VideoService = USING_MOCK_API ? new MockVideoServiceAdapter() : new ApiVideoService();

/** Where the API lives, for status messages. */
export const API_ORIGIN = apiUrl("");
