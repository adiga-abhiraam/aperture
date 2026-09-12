export type ProcessingStatus = 'preprocessed' | 'processing' | 'not_processed' | 'failed';

export interface TranscriptSegment {
  id: string;
  start: number; // in seconds
  end: number;
  text: string;
  speaker?: string;
  confidence?: number;
}

export interface VisualDetection {
  id: string;
  timestamp: number; // in seconds
  label: string;
  confidence: number;
  category: 'object' | 'person' | 'vehicle' | 'action' | 'scene';
  thumbnailUrl?: string;
  description: string;
}

export interface VideoProcessingDetails {
  status: ProcessingStatus;
  progressPercent: number;
  currentStep?: string;
  totalSteps?: number;
  completedSteps?: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  steps: {
    name: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    duration?: string;
  }[];
}

export interface VideoMetadata {
  resolution: string;
  fps: number;
  fileSize: string;
  format: string;
  vectorCount: number;
  embeddingModels: {
    audio: string;
    visual: string;
    text: string;
  };
}

export interface Video {
  id: string;
  /** Identifier used inside the search index (content hash); differs from `id`. */
  indexVideoId?: string;
  /** Runtime profile the job used: "self-hosted-v1" (CPU) or "api-gemini-free-v1". */
  profileId?: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  duration: number; // in seconds
  uploadedAt: string;
  status: ProcessingStatus;
  processingDetails: VideoProcessingDetails;
  metadata: VideoMetadata;
  category: string;
  tags: string[];
  queryCount: number;
  transcripts: TranscriptSegment[];
  visualDetections: VisualDetection[];
  suggestedQuestions: string[];
}
