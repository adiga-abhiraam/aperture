import { Video, ProcessingStatus } from "@/types/video";

const STORAGE_KEY = "aperture_user_videos";

export class MockVideoService {
  private videos: Video[] = [];
  private listeners: (() => void)[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window !== "undefined") {
      try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
          this.videos = JSON.parse(data);
        } else {
          // Starts completely empty as requested!
          this.videos = [];
        }
      } catch (e) {
        console.error("Failed to load videos from storage", e);
        this.videos = [];
      }
    }
  }

  private saveToStorage() {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.videos));
      } catch (e) {
        console.error("Failed to save videos to storage", e);
      }
    }
    this.notifyListeners();
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((l) => l());
  }

  public getAllVideos(): Video[] {
    return [...this.videos];
  }

  public getVideoById(id: string): Video | undefined {
    return this.videos.find((v) => v.id === id);
  }

  public filterVideos(params: {
    query?: string;
    status?: ProcessingStatus | 'all';
    category?: string;
    sortBy?: 'newest' | 'oldest' | 'duration' | 'title';
  }): Video[] {
    let result = [...this.videos];

    // Status filter
    if (params.status && params.status !== 'all') {
      result = result.filter((v) => v.status === params.status);
    }

    // Category filter
    if (params.category && params.category !== 'All') {
      result = result.filter((v) => v.category.toLowerCase().includes(params.category!.toLowerCase()));
    }

    // Text search query filter
    if (params.query && params.query.trim() !== '') {
      const q = params.query.toLowerCase().trim();
      result = result.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.description.toLowerCase().includes(q) ||
          v.tags.some((t) => t.toLowerCase().includes(q)) ||
          v.transcripts.some((t) => t.text.toLowerCase().includes(q)) ||
          v.visualDetections.some((vd) => vd.label.toLowerCase().includes(q) || vd.description.toLowerCase().includes(q))
      );
    }

    // Sorting
    if (params.sortBy === 'oldest') {
      result.sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime());
    } else if (params.sortBy === 'duration') {
      result.sort((a, b) => b.duration - a.duration);
    } else if (params.sortBy === 'title') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      result.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    }

    return result;
  }

  public addUploadedVideo(params: {
    title: string;
    description?: string;
    category?: string;
    tags?: string[];
    videoUrl?: string;
    thumbnailUrl?: string;
    duration?: number;
    fileSize?: string;
    startProcessingImmediately?: boolean;
  }): Video {
    const shouldProcess = params.startProcessingImmediately ?? false;
    const initialStatus: ProcessingStatus = shouldProcess ? "processing" : "not_processed";

    const video: Video = {
      id: `vid-${Date.now()}`,
      title: params.title.trim(),
      description: params.description?.trim() || "Uploaded video archive awaiting indexing.",
      // Empty means "no captured frame yet"; the card renders the video's own first frame.
      thumbnailUrl: params.thumbnailUrl || "",
      videoUrl: params.videoUrl || "/media/animal_belly_rub.webm",
      duration: params.duration || 180,
      uploadedAt: new Date().toISOString(),
      status: initialStatus,
      category: params.category || "General",
      tags: params.tags && params.tags.length > 0 ? params.tags : ["uploaded", "raw"],
      queryCount: 0,
      metadata: {
        resolution: "1080p Full HD",
        fps: 30,
        fileSize: params.fileSize || "—",
        format: "WEBM / MP4",
        vectorCount: 0,
        embeddingModels: {
          audio: "Whisper large-v3",
          visual: "X-CLIP ViT-B/16",
          text: "BGE-M3 Multilingual",
        },
      },
      processingDetails: {
        status: initialStatus,
        progressPercent: shouldProcess ? 10 : 0,
        currentStep: shouldProcess ? "Extracting audio track & keyframing" : "Awaiting processing trigger",
        steps: [
          { name: "Audio Extraction & Demux", description: "Demux 48kHz audio track", status: shouldProcess ? "in_progress" : "pending" },
          { name: "Whisper ASR Transcription", description: "Generate timestamped speech tokens", status: "pending" },
          { name: "X-CLIP Visual Keyframing", description: "Sample keyframes & 512-dim visual embeddings", status: "pending" },
          { name: "Qdrant Named-Vector Indexing", description: "Commit hybrid vectors to collection", status: "pending" },
        ],
      },
      transcripts: [],
      visualDetections: [],
      suggestedQuestions: [
        "What does the person say at the beginning?",
        "When does the car enter the frame?",
        "What happens around 2 minutes?",
        "Is anyone wearing a red shirt?",
        "What is being discussed in this video?",
      ],
    };

    this.videos.unshift(video);
    this.saveToStorage();

    if (shouldProcess) {
      this.triggerProcessing(video.id);
    }

    return video;
  }

  public async triggerProcessing(videoId: string, onProgress?: (percent: number) => void): Promise<void> {
    const video = this.getVideoById(videoId);
    if (!video) return;

    video.status = "processing";
    video.processingDetails.status = "processing";
    video.processingDetails.progressPercent = 15;
    video.processingDetails.currentStep = "Extracting audio track & demuxing container";
    video.processingDetails.steps[0].status = "in_progress";
    this.saveToStorage();
    if (onProgress) onProgress(15);

    // Stage 1: Audio Done -> ASR
    await new Promise((res) => setTimeout(res, 800));
    video.processingDetails.progressPercent = 40;
    video.processingDetails.currentStep = "Whisper ASR: generating dialogue tokens";
    video.processingDetails.steps[0].status = "completed";
    video.processingDetails.steps[1].status = "in_progress";
    this.saveToStorage();
    if (onProgress) onProgress(40);

    // Stage 2: ASR Done -> Visual Keyframing
    await new Promise((res) => setTimeout(res, 900));
    video.processingDetails.progressPercent = 75;
    video.processingDetails.currentStep = "X-CLIP: extracting 512-dim frame representations";
    video.processingDetails.steps[1].status = "completed";
    video.processingDetails.steps[2].status = "in_progress";
    this.saveToStorage();
    if (onProgress) onProgress(75);

    // Stage 3: Visual Done -> Qdrant
    await new Promise((res) => setTimeout(res, 700));
    video.processingDetails.progressPercent = 100;
    video.processingDetails.currentStep = "Multimodal indexing complete";
    video.processingDetails.steps[2].status = "completed";
    video.processingDetails.steps[3].status = "completed";
    video.status = "preprocessed";
    video.processingDetails.status = "preprocessed";
    video.metadata.vectorCount = Math.floor(video.duration * 4.5);

    // Populate realistic transcripts and visual detections once preprocessed
    video.transcripts = [
      { id: "t-init-1", start: 3, end: 12, text: "System calibrated and recording initiated. All camera telemetry operational.", speaker: "Lead Engineer" },
      { id: "t-init-2", start: 24, end: 42, text: "Beginning multimodal test protocol. Notice the motion tracking and target localization across frames.", speaker: "Lead Engineer" },
      { id: "t-init-3", start: 84, end: 105, text: "Vehicle hazard entering perimeter. Object detection model locking onto vehicle bounding box.", speaker: "Ground Safety" },
      { id: "t-init-4", start: 165, end: 185, text: "Safety inspector in red shirt signals all clear for high speed trial.", speaker: "Inspector" },
    ];

    video.visualDetections = [
      { id: "vd-init-1", timestamp: 14, label: "Initial staging area", confidence: 0.98, category: "scene", description: "Open test hangar floor with boundary markers" },
      { id: "vd-init-2", timestamp: 84, label: "Dark vehicle enters frame", confidence: 0.97, category: "vehicle", description: "Automobile enters frame from right boundary at 01:24" },
      { id: "vd-init-3", timestamp: 165, label: "Person wearing red shirt", confidence: 0.99, category: "person", description: "Safety engineer wearing bright red shirt inspecting perimeter at 02:45" },
    ];

    this.saveToStorage();
    if (onProgress) onProgress(100);
  }

  public deleteVideo(id: string) {
    this.videos = this.videos.filter((v) => v.id !== id);
    this.saveToStorage();
  }

  public clearAllVideos() {
    this.videos = [];
    this.saveToStorage();
  }
}

export const mockVideoService = new MockVideoService();
