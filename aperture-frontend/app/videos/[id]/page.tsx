"use client";

import React, { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { AppShell } from "@/components/shared";
import { VideoPlayerProvider, VideoPlayer } from "@/features/video-player";
import { VideoHeader, VideoDetailsBox, TranscriptViewer, VisualTimeline, useVideo } from "@/features/video-review";
import { ProcessingTimeline } from "@/features/processing-status";
import { ChatPanel } from "@/features/ai-chat";
import { DeleteVideoDialog } from "@/features/dashboard";
import { videoService } from "@/services/videoService";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type Tab = "transcript" | "moments";

// From lg up the page is a two-column grid: content, then a chat column that
// sticks to the right edge for the full viewport height (ChatGPT-style).
// Being a real grid column, it can never overlap the player.
const GRID = "lg:grid lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]";

export default function VideoReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: videoId } = use(params);
  const router = useRouter();
  const { video, error, startProcessing } = useVideo(videoId);
  const [tab, setTab] = useState<Tab>("transcript");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (video === undefined) {
    return (
      <AppShell defaultSidebarOpen={false}>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-surface-high border-t-primary" />
        </div>
      </AppShell>
    );
  }

  if (video === null) {
    return (
      <AppShell defaultSidebarOpen={false}>
        <div className="flex flex-col items-center py-32 text-center">
          {error ? (
            <>
              <AlertCircle className="h-10 w-10 text-error" />
              <h1 className="mt-4 text-[22px] text-on-surface">Couldn&apos;t load this video</h1>
              <p className="mt-2 max-w-md text-sm text-on-muted">{error.message}</p>
            </>
          ) : (
            <>
              <h1 className="text-[22px] text-on-surface">This video isn&apos;t in your library</h1>
              <p className="mt-2 text-sm text-on-muted">It may have been removed, or the link is wrong.</p>
            </>
          )}
          <Link href="/dashboard" className="mt-6">
            <Button variant="tonal">Back to your videos</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "transcript", label: "Transcript", count: video.transcripts.length },
    { id: "moments", label: "Visual moments", count: video.visualDetections.length },
  ];

  return (
    <VideoPlayerProvider>
      <AppShell defaultSidebarOpen={false} contentClassName="lg:pr-0 lg:pb-0">
        <div className={GRID}>
          <div className="min-w-0 max-w-[1280px] space-y-4 pb-16 pt-2 lg:pr-6 animate-fade-in">
            <VideoPlayer video={video} />
            <VideoHeader
              video={video}
              onOpenProcessingDetails={() => setDetailsOpen(true)}
              onStartProcessing={startProcessing}
              onDelete={() => setConfirmDelete(true)}
            />
            <VideoDetailsBox video={video} />

            {video.status === "processing" && (
              <div className="rounded-xl bg-surface p-5 shadow-e1">
                <ProcessingTimeline details={video.processingDetails} />
              </div>
            )}

            <section className="rounded-xl bg-surface p-2 shadow-e1 sm:p-3">
              <div role="tablist" className="flex gap-1 border-b border-outline-variant px-1">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={tab === t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "relative flex h-12 items-center gap-2 px-4 text-sm transition-colors",
                      tab === t.id ? "font-medium text-primary" : "text-on-variant hover:text-on-surface"
                    )}
                  >
                    {t.label}
                    <span className="rounded-full bg-surface-container px-2 py-px text-xs tabular-nums text-on-muted">{t.count}</span>
                    {tab === t.id && <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-primary animate-fade-in" />}
                  </button>
                ))}
              </div>
              <div className="pt-3">
                {tab === "transcript" ? (
                  <TranscriptViewer transcripts={video.transcripts} />
                ) : (
                  <VisualTimeline detections={video.visualDetections} />
                )}
              </div>
            </section>

            {/* Below lg the chat stacks under the content at a fixed height. */}
            <div className="lg:hidden">
              <ChatPanel video={video} className="h-[70vh] rounded-[20px] border shadow-e1" />
            </div>
          </div>

          <div className="hidden lg:block">
            <div className="sticky top-16 h-[calc(100vh-64px)]">
              <ChatPanel video={video} className="h-full" />
            </div>
          </div>
        </div>

        <DeleteVideoDialog
          video={confirmDelete ? video : null}
          onClose={() => setConfirmDelete(false)}
          onConfirm={async (v) => {
            await videoService.delete(v.id);
            router.replace("/dashboard");
          }}
        />

        <Modal isOpen={detailsOpen} onClose={() => setDetailsOpen(false)} title="Processing details" description={video.title}>
          <ProcessingTimeline details={video.processingDetails} />
        </Modal>
      </AppShell>
    </VideoPlayerProvider>
  );
}
