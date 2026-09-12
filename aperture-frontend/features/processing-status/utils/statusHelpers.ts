import { ProcessingStatus } from "@/types/video";

export interface StatusConfig {
  label: string;
  tone: "success" | "warning" | "neutral" | "error";
  iconName: "check" | "loader" | "circle" | "alert";
  /** Plain-language explanation shown in tooltips and the details dialog. */
  description: string;
}

export const STATUS_CONFIGS: Record<ProcessingStatus, StatusConfig> = {
  preprocessed: {
    label: "Ready",
    tone: "success",
    iconName: "check",
    description: "Transcript and visual index are ready. You can search and ask questions.",
  },
  processing: {
    label: "Processing",
    tone: "warning",
    iconName: "loader",
    description: "Transcribing speech and indexing frames. This usually takes a few minutes.",
  },
  not_processed: {
    label: "Not processed",
    tone: "neutral",
    iconName: "circle",
    description: "Uploaded but not indexed yet. Start processing to enable search and chat.",
  },
  failed: {
    label: "Failed",
    tone: "error",
    iconName: "alert",
    description: "Processing stopped because of an error. You can retry.",
  },
};

export function getStatusConfig(status: ProcessingStatus): StatusConfig {
  return STATUS_CONFIGS[status] || STATUS_CONFIGS.not_processed;
}
