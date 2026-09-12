/**
 * Video-scoped chat over the retrieval API.
 *
 * There is deliberately no free-form LLM here: a question becomes a
 * multimodal search restricted to this video, and the reply is composed
 * from the windows that actually matched, each cited with its timestamp.
 * If nothing matches, it says so rather than inventing an answer.
 */
import { ChatMessage, EvidenceCitation } from "@/types/chat";
import { Video } from "@/types/video";
import { formatDuration } from "@/lib/formatters";
import { api, ApiError } from "./api/client";
import { SearchResponse, SearchResultItem } from "./api/types";
import { mockChatService } from "./mockChatService";
import { USING_MOCK_API } from "./videoService";

export interface ChatService {
  history(video: Video): ChatMessage[];
  ask(video: Video, query: string): Promise<ChatMessage>;
}

const TOP_K = 5;

function citationFor(hit: SearchResultItem, i: number): EvidenceCitation {
  const start = hit.refined_start ?? hit.start;
  const speech = hit.matched_modalities.includes("speech") && hit.transcript.trim();
  const snippet = speech ? hit.transcript.trim() : hit.caption.trim() || hit.transcript.trim();
  return {
    id: `${hit.window_id}-${i}`,
    timestamp: start,
    timestampLabel: formatDuration(start),
    type: speech ? "transcript" : hit.matched_modalities.includes("audio") && !hit.caption ? "audio" : "visual",
    confidence: hit.verification?.confidence ?? Math.max(0, Math.min(1, hit.score)),
    snippet: snippet || "Matched by visual similarity",
    sourceModel: hit.matched_modalities.join(" + ") || "retrieval",
  };
}

function compose(hits: SearchResultItem[]): string {
  if (hits.length === 0) {
    return "I couldn't find anything in this video that matches that. Try describing what is said or what is on screen in different words.";
  }
  const [best, ...rest] = hits;
  const at = formatDuration(best.refined_start ?? best.start);
  const what = best.verification?.evidence?.trim() || best.caption.trim() || best.transcript.trim();
  const lead = what ? `The closest match is at [${at}]: ${what}` : `The closest match is at [${at}].`;
  if (rest.length === 0) return lead;
  const others = rest
    .slice(0, 3)
    .map((h) => `[${formatDuration(h.refined_start ?? h.start)}]`)
    .join(", ");
  return `${lead}\n\nOther moments worth checking: ${others}.`;
}

class ApiChatService implements ChatService {
  private histories = new Map<string, ChatMessage[]>();

  history(video: Video) {
    return this.histories.get(video.id) ?? [];
  }

  async ask(video: Video, query: string): Promise<ChatMessage> {
    this.push(video, {
      id: `user-${Date.now()}`,
      videoId: video.id,
      role: "user",
      content: query,
      createdAt: new Date().toISOString(),
    });
    // video_id in the index is the content hash, not the job id.
    const indexVideoId = video.indexVideoId ?? video.id;
    let response: SearchResponse;
    try {
      response = await api<SearchResponse>("/api/query/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, top_k: TOP_K, video_id: indexVideoId }),
      });
    } catch (err) {
      const reason =
        err instanceof ApiError
          ? err.isNetwork
            ? "the Aperture API isn't reachable"
            : err.message.replace(/\.$/, "")
          : "something went wrong";
      return this.push(video, {
        id: `assistant-${Date.now()}`,
        videoId: video.id,
        role: "assistant",
        content: `I can't search this video at the moment — ${reason}.`,
        createdAt: new Date().toISOString(),
      });
    }

    const hits = response.results.filter((r) => r.state !== "rejected");
    const message: ChatMessage = {
      id: `assistant-${Date.now()}`,
      videoId: video.id,
      role: "assistant",
      content: compose(hits),
      createdAt: new Date().toISOString(),
      citations: hits.map(citationFor),
    };
    return this.push(video, message);
  }

  private push(video: Video, message: ChatMessage): ChatMessage {
    const history = this.histories.get(video.id) ?? [];
    this.histories.set(video.id, [...history, message]);
    return message;
  }
}

class MockChatServiceAdapter implements ChatService {
  history(video: Video) {
    return mockChatService.getMessagesForVideo(video.id);
  }
  ask(video: Video, query: string) {
    return mockChatService.sendMessage(video, query);
  }
}

export const chatService: ChatService = USING_MOCK_API ? new MockChatServiceAdapter() : new ApiChatService();
