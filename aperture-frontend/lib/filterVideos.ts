import { ProcessingStatus, Video } from "@/types/video";

export type SortKey = "newest" | "oldest" | "duration" | "title";

export interface VideoFilter {
  query?: string;
  status?: ProcessingStatus | "all";
  sortBy?: SortKey;
}

/** Client-side filter + sort over the loaded library. */
export function filterVideos(videos: Video[], { query, status, sortBy = "newest" }: VideoFilter): Video[] {
  let result = videos;

  if (status && status !== "all") result = result.filter((v) => v.status === status);

  const q = query?.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        v.transcripts.some((t) => t.text.toLowerCase().includes(q)) ||
        v.visualDetections.some((d) => d.label.toLowerCase().includes(q) || d.description.toLowerCase().includes(q))
    );
  }

  const byDate = (a: Video, b: Video) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
  const sorters: Record<SortKey, (a: Video, b: Video) => number> = {
    newest: byDate,
    oldest: (a, b) => -byDate(a, b),
    duration: (a, b) => b.duration - a.duration,
    title: (a, b) => a.title.localeCompare(b.title),
  };
  return [...result].sort(sorters[sortBy]);
}
