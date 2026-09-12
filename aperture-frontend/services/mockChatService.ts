import { ChatMessage, EvidenceCitation, TimestampCitation } from "@/types/chat";
import { Video } from "@/types/video";

export const INITIAL_MOCK_CHATS: Record<string, ChatMessage[]> = {
  "video-1": [
    {
      id: "msg-1-1",
      videoId: "video-1",
      role: "user",
      content: "What does the person say at the beginning?",
      createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    },
    {
      id: "msg-1-2",
      videoId: "video-1",
      role: "assistant",
      content: "At [00:03], the narrator introduces the video by saying: *\"Nothing beats a calm morning stretch and a relaxing belly rub from your favorite human.\"* Shortly after at [00:08], Barnaby the golden retriever rolls onto his back on the lawn.",
      createdAt: new Date(Date.now() - 15 * 60 * 1000 + 1500).toISOString(),
      timestamps: [
        { seconds: 3, label: "00:03", description: "Narrator intro quote" },
        { seconds: 8, label: "00:08", description: "Golden retriever rolls over" },
      ],
      citations: [
        {
          id: "cit-1-1",
          timestamp: 3,
          timestampLabel: "00:03",
          type: "transcript",
          confidence: 0.99,
          snippet: "Nothing beats a calm morning stretch and a relaxing belly rub from your favorite human.",
          sourceModel: "Whisper large-v3 ASR",
        },
        {
          id: "cit-1-2",
          timestamp: 8,
          timestampLabel: "00:08",
          type: "visual",
          confidence: 0.98,
          snippet: "Golden retriever rolling upside down on bright green grass lawn",
          thumbnailUrl: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400&auto=format&fit=crop&q=60",
          sourceModel: "X-CLIP ViT-B/16",
        },
      ],
    },
    {
      id: "msg-1-3",
      videoId: "video-1",
      role: "user",
      content: "What happens around 2 minutes?",
      createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    },
    {
      id: "msg-1-4",
      videoId: "video-1",
      role: "assistant",
      content: "Around the two-minute mark at [01:58], handler Sarah introduces a rescued baby badger. At [02:05], the badger rolls onto its back, makes happy chirping noises, and playfully grabs the handler's fingers while receiving gentle belly scratches.",
      createdAt: new Date(Date.now() - 8 * 60 * 1000 + 1200).toISOString(),
      timestamps: [
        { seconds: 118, label: "01:58", description: "Baby badger appears" },
        { seconds: 125, label: "02:05", description: "Badger belly scratch & chirping" },
      ],
      citations: [
        {
          id: "cit-1-3",
          timestamp: 118,
          timestampLabel: "01:58",
          type: "visual",
          confidence: 0.97,
          snippet: "Sanctuary handler gently scratching badger belly with soft strokes",
          thumbnailUrl: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400&auto=format&fit=crop&q=60",
          sourceModel: "X-CLIP ViT-B/16",
        },
        {
          id: "cit-1-4",
          timestamp: 125,
          timestampLabel: "02:05",
          type: "transcript",
          confidence: 0.96,
          snippet: "Look at the baby badger around the two minute mark. It chirps happily and grabs your fingers.",
          sourceModel: "Whisper ASR",
        },
      ],
    },
  ],
  "video-2": [
    {
      id: "msg-2-1",
      videoId: "video-2",
      role: "user",
      content: "When does the car enter the frame?",
      createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    },
    {
      id: "msg-2-2",
      videoId: "video-2",
      role: "assistant",
      content: "The moving vehicle hazard enters the runway from the right at [01:24]. By [01:35], the drone's optical stereo system locks onto the vehicle's bounding box and computes an evasive vertical step.",
      createdAt: new Date(Date.now() - 20 * 60 * 1000 + 1400).toISOString(),
      timestamps: [
        { seconds: 84, label: "01:24", description: "Dark silver sedan enters runway frame" },
        { seconds: 95, label: "01:35", description: "Drone stereo avoidance lock" },
      ],
      citations: [
        {
          id: "cit-2-1",
          timestamp: 84,
          timestampLabel: "01:24",
          type: "visual",
          confidence: 0.97,
          snippet: "Dark silver electric sedan enters from the right frame into flight test runway",
          thumbnailUrl: "https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=400&auto=format&fit=crop&q=60",
          sourceModel: "X-CLIP ViT-B/16 Object Detector",
        },
        {
          id: "cit-2-2",
          timestamp: 82,
          timestampLabel: "01:22",
          type: "transcript",
          confidence: 0.98,
          snippet: "Ground Control: 'Moving vehicle hazard initiated. Autonomous sedan entering runway perimeter now.'",
          sourceModel: "Whisper large-v3 ASR",
        },
      ],
    },
    {
      id: "msg-2-3",
      videoId: "video-2",
      role: "user",
      content: "Is anyone wearing a red shirt?",
      createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    },
    {
      id: "msg-2-4",
      videoId: "video-2",
      role: "assistant",
      content: "Yes, definitely! At [02:45], a ground safety inspector wearing a **bright red high-visibility polo shirt** and yellow safety goggles walks into the hangar perimeter to inspect rotor downwash and signal clearance.",
      createdAt: new Date(Date.now() - 10 * 60 * 1000 + 1300).toISOString(),
      timestamps: [
        { seconds: 165, label: "02:45", description: "Inspector in red shirt enters hangar perimeter" },
      ],
      citations: [
        {
          id: "cit-2-3",
          timestamp: 165,
          timestampLabel: "02:45",
          type: "visual",
          confidence: 0.98,
          snippet: "Ground safety engineer in vivid red polo shirt holding inspection tablet",
          thumbnailUrl: "https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=400&auto=format&fit=crop&q=60",
          sourceModel: "X-CLIP ViT-B/16 Visual Search",
        },
      ],
    },
  ],
};

export class MockChatService {
  private chatHistories: Record<string, ChatMessage[]> = { ...INITIAL_MOCK_CHATS };

  public getMessagesForVideo(videoId: string): ChatMessage[] {
    if (!this.chatHistories[videoId]) {
      this.chatHistories[videoId] = [];
    }
    return [...this.chatHistories[videoId]];
  }

  public async sendMessage(video: Video, userQuery: string): Promise<ChatMessage> {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      videoId: video.id,
      role: "user",
      content: userQuery,
      createdAt: new Date().toISOString(),
    };

    if (!this.chatHistories[video.id]) {
      this.chatHistories[video.id] = [];
    }
    this.chatHistories[video.id].push(userMsg);

    // Simulate thinking delay
    await new Promise((res) => setTimeout(res, 450));

    const response = this.generateGroundedResponse(video, userQuery);
    this.chatHistories[video.id].push(response);
    return response;
  }

  private generateGroundedResponse(video: Video, query: string): ChatMessage {
    const q = query.toLowerCase().trim();
    const messageId = `msg-ai-${Date.now()}`;
    const now = new Date().toISOString();

    // Check if video is not processed or failed
    if (video.status === 'not_processed') {
      return {
        id: messageId,
        videoId: video.id,
        role: "assistant",
        content: `This video (**${video.title}**) is currently in the **Not processed** queue. Ingestion and multimodal vector indexing have not started yet. Click the **"Start Ingest"** button above to trigger transcription and frame embedding.`,
        createdAt: now,
      };
    }

    if (video.status === 'failed') {
      return {
        id: messageId,
        videoId: video.id,
        role: "assistant",
        content: `Multimodal indexing for this video failed with the following error:\n\n> *${video.processingDetails.error || "Audio/video container demuxing error"}*\n\nPlease re-encode or upload a supported MP4/WEBM container to enable AI search.`,
        createdAt: now,
      };
    }

    if (video.status === 'processing') {
      return {
        id: messageId,
        videoId: video.id,
        role: "assistant",
        content: `This video is currently **${video.processingDetails.progressPercent}% preprocessed** (Current step: *${video.processingDetails.currentStep || "Indexing"}*). Early queries are partially available from available speech tokens.`,
        createdAt: now,
      };
    }

    // 1. "What does the person say at the beginning?"
    if (q.includes("say at the beginning") || q.includes("person say") || q.includes("first say") || q.includes("spoken at start")) {
      const firstSegment = video.transcripts[0];
      if (firstSegment) {
        const tsLabel = `00:${firstSegment.start.toString().padStart(2, "0")}`;
        return {
          id: messageId,
          videoId: video.id,
          role: "assistant",
          content: `At [${tsLabel}], ${firstSegment.speaker || "the speaker"} says:\n\n> *\"${firstSegment.text}\"*\n\nThis marks the opening audio segment of the video.`,
          createdAt: now,
          timestamps: [{ seconds: firstSegment.start, label: tsLabel, description: "Opening speech segment" }],
          citations: [
            {
              id: `cit-${Date.now()}`,
              timestamp: firstSegment.start,
              timestampLabel: tsLabel,
              type: "transcript",
              confidence: 0.99,
              snippet: firstSegment.text,
              sourceModel: "Whisper large-v3 ASR",
            },
          ],
        };
      }
    }

    // 2. "When does the car enter the frame?"
    if (q.includes("car enter") || q.includes("vehicle enter") || q.includes("car in frame") || q.includes("car")) {
      const carDetection = video.visualDetections.find((d) => d.label.toLowerCase().includes("sedan") || d.label.toLowerCase().includes("car") || d.label.toLowerCase().includes("vehicle"));
      if (carDetection) {
        const mins = Math.floor(carDetection.timestamp / 60);
        const secs = carDetection.timestamp % 60;
        const tsLabel = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
        return {
          id: messageId,
          videoId: video.id,
          role: "assistant",
          content: `The vehicle appears at [${tsLabel}]. Specifically, ${carDetection.description}. The visual detector registered a confidence score of **${Math.round(carDetection.confidence * 100)}%**.`,
          createdAt: now,
          timestamps: [{ seconds: carDetection.timestamp, label: tsLabel, description: carDetection.label }],
          citations: [
            {
              id: `cit-${Date.now()}`,
              timestamp: carDetection.timestamp,
              timestampLabel: tsLabel,
              type: "visual",
              confidence: carDetection.confidence,
              snippet: carDetection.description,
              thumbnailUrl: video.thumbnailUrl,
              sourceModel: "X-CLIP ViT-B/16",
            },
          ],
        };
      } else {
        return {
          id: messageId,
          videoId: video.id,
          role: "assistant",
          content: `Across all ${video.visualDetections.length} indexed keyframes for this video (**${video.title}**), no automobiles or cars were detected. This video features ${video.category.toLowerCase()} content.`,
          createdAt: now,
        };
      }
    }

    // 3. "What happens around 2 minutes?"
    if (q.includes("2 minutes") || q.includes("two minutes") || q.includes("around 2 min") || q.includes("at 2:")) {
      const targetSec = 120;
      // Find closest visual detection or transcript
      const segment = video.transcripts.find((t) => Math.abs(t.start - targetSec) < 30) || video.transcripts[video.transcripts.length > 2 ? 2 : 0];
      const visual = video.visualDetections.find((v) => Math.abs(v.timestamp - targetSec) < 30);

      const tsSec = visual ? visual.timestamp : segment ? segment.start : 120;
      const mins = Math.floor(tsSec / 60);
      const secs = tsSec % 60;
      const tsLabel = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;

      const desc = visual ? visual.description : segment ? segment.text : "Key activity transition";
      return {
        id: messageId,
        videoId: video.id,
        role: "assistant",
        content: `Around the two-minute mark at [${tsLabel}]:\n\n- **Visual**: ${desc}\n${segment ? `- **Spoken**: *\"${segment.text}\"*` : ""}`,
        createdAt: now,
        timestamps: [{ seconds: tsSec, label: tsLabel, description: desc }],
        citations: [
          {
            id: `cit-${Date.now()}`,
            timestamp: tsSec,
            timestampLabel: tsLabel,
            type: visual ? "visual" : "transcript",
            confidence: 0.96,
            snippet: desc,
            thumbnailUrl: video.thumbnailUrl,
            sourceModel: visual ? "X-CLIP ViT-B/16" : "Whisper ASR",
          },
        ],
      };
    }

    // 4. "Is anyone wearing a red shirt?"
    if (q.includes("red shirt") || q.includes("red vest") || q.includes("wearing red") || q.includes("red jacket")) {
      const redMatch = video.visualDetections.find((d) => d.label.toLowerCase().includes("red") || d.description.toLowerCase().includes("red"));
      if (redMatch) {
        const mins = Math.floor(redMatch.timestamp / 60);
        const secs = redMatch.timestamp % 60;
        const tsLabel = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
        return {
          id: messageId,
          videoId: video.id,
          role: "assistant",
          content: `Yes! At [${tsLabel}], the system identified a person wearing vivid red attire: **${redMatch.description}** (Detection confidence: **${Math.round(redMatch.confidence * 100)}%**).`,
          createdAt: now,
          timestamps: [{ seconds: redMatch.timestamp, label: tsLabel, description: redMatch.label }],
          citations: [
            {
              id: `cit-${Date.now()}`,
              timestamp: redMatch.timestamp,
              timestampLabel: tsLabel,
              type: "visual",
              confidence: redMatch.confidence,
              snippet: redMatch.description,
              thumbnailUrl: video.thumbnailUrl,
              sourceModel: "X-CLIP ViT-B/16 Visual Query",
            },
          ],
        };
      } else {
        return {
          id: messageId,
          videoId: video.id,
          role: "assistant",
          content: `No instances of anyone wearing a red shirt or red clothing were detected in **${video.title}**. The visual indexing model (X-CLIP) found zero matches above the 0.5 confidence threshold.`,
          createdAt: now,
        };
      }
    }

    // 5. "What is being discussed in this video?"
    if (q.includes("discussed") || q.includes("about") || q.includes("summary") || q.includes("overview") || q.includes("topic")) {
      const timestamps: TimestampCitation[] = [];
      if (video.transcripts.length > 0) {
        const t1 = video.transcripts[0];
        timestamps.push({ seconds: t1.start, label: `00:${t1.start.toString().padStart(2, "0")}`, description: "Intro" });
      }
      if (video.transcripts.length > 3) {
        const t2 = video.transcripts[3];
        timestamps.push({ seconds: t2.start, label: `01:${(t2.start % 60).toString().padStart(2, "0")}`, description: "Core topic" });
      }

      return {
        id: messageId,
        videoId: video.id,
        role: "assistant",
        content: `**Overview of \"${video.title}\"**:\n\n${video.description}\n\nKey topics covered:\n${video.tags.map((t) => `• **#${t}**`).join("\n")}\n\nKey discussion starts at [${timestamps[0]?.label || "00:00"}].`,
        createdAt: now,
        timestamps,
        citations: video.transcripts.slice(0, 1).map((t, idx) => ({
          id: `cit-sum-${idx}`,
          timestamp: t.start,
          timestampLabel: `00:${t.start.toString().padStart(2, "0")}`,
          type: "transcript",
          confidence: 0.98,
          snippet: t.text,
          sourceModel: "BGE-M3 Dense Rerank",
        })),
      };
    }

    // Fallback: search video transcripts and detections
    const matchedTranscript = video.transcripts.find((t) => t.text.toLowerCase().includes(q));
    const matchedVisual = video.visualDetections.find((v) => v.label.toLowerCase().includes(q) || v.description.toLowerCase().includes(q));

    if (matchedTranscript || matchedVisual) {
      const ts = matchedVisual ? matchedVisual.timestamp : matchedTranscript!.start;
      const mins = Math.floor(ts / 60);
      const secs = ts % 60;
      const tsLabel = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
      const desc = matchedVisual ? matchedVisual.description : matchedTranscript!.text;

      return {
        id: messageId,
        videoId: video.id,
        role: "assistant",
        content: `Found evidence for **\"${query}\"** at [${tsLabel}]:\n\n> *${desc}*`,
        createdAt: now,
        timestamps: [{ seconds: ts, label: tsLabel, description: desc }],
        citations: [
          {
            id: `cit-match-${Date.now()}`,
            timestamp: ts,
            timestampLabel: tsLabel,
            type: matchedVisual ? "visual" : "transcript",
            confidence: 0.94,
            snippet: desc,
            sourceModel: matchedVisual ? "X-CLIP ViT-B/16" : "Whisper ASR",
          },
        ],
      };
    }

    // Generic grounded fallback for this video
    return {
      id: messageId,
      videoId: video.id,
      role: "assistant",
      content: `In **\"${video.title}\"**, the indexed content highlights **${video.category}** with focus on ${video.tags.slice(0, 3).join(", ")}. You can ask about spoken dialogue, visual events, or specific timestamp intervals.`,
      createdAt: now,
    };
  }
}

export const mockChatService = new MockChatService();
