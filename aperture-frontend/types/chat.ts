export interface TimestampCitation {
  seconds: number;
  label: string; // e.g., "01:24"
  description?: string;
}

export interface EvidenceCitation {
  id: string;
  timestamp: number;
  timestampLabel: string;
  type: 'visual' | 'transcript' | 'audio';
  confidence: number;
  snippet: string;
  thumbnailUrl?: string;
  sourceModel: string; // e.g., "X-CLIP ViT-B/16", "Whisper ASR", "CLAP"
}

export interface ChatMessage {
  id: string;
  videoId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  citations?: EvidenceCitation[];
  timestamps?: TimestampCitation[];
  isStreaming?: boolean;
}

export interface SuggestedQuery {
  id: string;
  text: string;
  category?: 'visual' | 'transcript' | 'summary' | 'entity';
}
