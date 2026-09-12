import { ProcessingStatus } from "./video";

export interface ProcessingPipelineSummary {
  totalVideos: number;
  preprocessedCount: number;
  processingCount: number;
  notProcessedCount: number;
  failedCount: number;
  totalHoursIndexed: number;
  totalVectorsIndexed: number;
}

export interface ProcessingStageInfo {
  id: string;
  name: string;
  description: string;
  order: number;
}
