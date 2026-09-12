/**
 * Client-side probing of a video source (object URL or same-origin path).
 * Used to build a real poster from the first frame instead of a placeholder,
 * and to read the true duration for the card.
 */

const PROBE_TIMEOUT_MS = 8000;

function loadVideo(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    const timer = setTimeout(() => reject(new Error("video probe timed out")), PROBE_TIMEOUT_MS);
    video.onloadedmetadata = () => {
      clearTimeout(timer);
      resolve(video);
    };
    video.onerror = () => {
      clearTimeout(timer);
      reject(new Error("video failed to load"));
    };
    video.src = src;
  });
}

/** Returns a JPEG data URL of the frame at `atSeconds`, or null if it can't be read. */
export async function captureVideoFrame(src: string, atSeconds = 0.5, maxWidth = 640): Promise<string | null> {
  if (typeof document === "undefined") return null;
  try {
    const video = await loadVideo(src);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("seek timed out")), PROBE_TIMEOUT_MS);
      video.onseeked = () => {
        clearTimeout(timer);
        resolve();
      };
      video.currentTime = Math.min(atSeconds, Math.max(0, (video.duration || 1) - 0.1));
    });
    const scale = Math.min(1, maxWidth / (video.videoWidth || maxWidth));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round((video.videoWidth || 640) * scale);
    canvas.height = Math.round((video.videoHeight || 360) * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    video.removeAttribute("src");
    video.load();
    return canvas.toDataURL("image/jpeg", 0.8);
  } catch {
    return null;
  }
}

/** Duration in seconds, or null if the metadata can't be read. */
export async function readVideoDuration(src: string): Promise<number | null> {
  if (typeof document === "undefined") return null;
  try {
    const video = await loadVideo(src);
    const d = video.duration;
    video.removeAttribute("src");
    video.load();
    return Number.isFinite(d) && d > 0 ? d : null;
  } catch {
    return null;
  }
}

/** True when a stored thumbnail is a placeholder rather than a real frame. */
export function isPlaceholderThumbnail(url: string | undefined): boolean {
  return !url || url.includes("unsplash.com");
}
