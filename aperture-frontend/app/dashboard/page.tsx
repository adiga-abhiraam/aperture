"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/shared";
import { Button } from "@/components/ui/Button";
import { VideoGrid, DashboardHeader, UploadModal, EmptyState, DeleteVideoDialog, useVideoFilter, useVideoLibrary } from "@/features/dashboard";
import { useUpload } from "@/features/upload";
import { API_ORIGIN } from "@/services/videoService";
import { ApiError } from "@/services/api/client";
import { ProcessingStatus, Video } from "@/types/video";

const STATUS_TITLES: Record<ProcessingStatus | "all", string> = {
  all: "Your videos",
  preprocessed: "Ready",
  processing: "Processing",
  not_processed: "Not processed",
  failed: "Failed",
};

function DashboardContent() {
  const searchParams = useSearchParams();
  const { pending, clear } = useUpload();
  const library = useVideoLibrary();
  const filter = useVideoFilter(library.videos);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Video | null>(null);

  // Deep links: /dashboard?status=failed&q=car
  useEffect(() => {
    const status = searchParams.get("status") as ProcessingStatus | null;
    if (status && status in STATUS_TITLES) filter.setSelectedStatus(status);
    const q = searchParams.get("q");
    if (q) filter.setSearchQuery(q);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c: Partial<Record<ProcessingStatus | "all", number>> = { all: library.videos.length };
    for (const v of library.videos) c[v.status] = (c[v.status] ?? 0) + 1;
    return c;
  }, [library.videos]);

  const apiDown = library.error instanceof ApiError && library.error.isNetwork;

  return (
    <AppShell
      searchQuery={filter.searchQuery}
      onSearchChange={filter.setSearchQuery}
      selectedStatus={filter.selectedStatus}
      onSelectStatus={filter.setSelectedStatus}
      counts={counts}
    >
      {library.error && (
        <div className="mt-2 flex flex-wrap items-center gap-3 rounded-xl bg-error-container px-4 py-3 text-sm text-error animate-fade-in">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="min-w-0 flex-1">
            {apiDown ? (
              <>
                Can&apos;t reach the Aperture API at <span className="font-medium">{API_ORIGIN}</span>. Start it with{" "}
                <code className="rounded bg-error/10 px-1">.\start-local.ps1</code> and try again.
              </>
            ) : (
              library.error.message
            )}
          </span>
          <Button variant="text" size="sm" onClick={() => void library.refresh()} className="text-error">
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      )}

      {uploadError && (
        <div className="mt-2 flex items-center gap-3 rounded-xl bg-error-container px-4 py-3 text-sm text-error animate-fade-in">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="flex-1">Upload failed: {uploadError}</span>
          <Button variant="text" size="sm" onClick={() => setUploadError(null)} className="text-error">
            Dismiss
          </Button>
        </div>
      )}

      {library.loading ? (
        <div className="grid grid-cols-1 gap-x-4 gap-y-8 pt-14 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse space-y-3">
              <div className="aspect-video rounded-xl bg-surface-high" />
              <div className="h-4 w-3/4 rounded bg-surface-high" />
              <div className="h-3 w-1/3 rounded bg-surface-high" />
            </div>
          ))}
        </div>
      ) : library.videos.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-5 pb-16 pt-2">
          <DashboardHeader
            title={filter.searchQuery ? `Results for “${filter.searchQuery}”` : STATUS_TITLES[filter.selectedStatus]}
            totalCount={filter.filteredVideos.length}
            layout={filter.layout}
            onToggleLayout={filter.setLayout}
            sortBy={filter.sortBy}
            onSortChange={filter.setSortBy}
          />
          <VideoGrid
            videos={filter.filteredVideos}
            layout={filter.layout}
            onResetFilters={filter.resetFilters}
            onStartProcessing={library.startProcessing}
            onDelete={setToDelete}
          />
        </div>
      )}

      <DeleteVideoDialog video={toDelete} onClose={() => setToDelete(null)} onConfirm={(v) => library.remove(v.id)} />

      <UploadModal
        pending={pending}
        onClose={clear}
        onConfirmUpload={async ({ title, startProcessing }) => {
          if (!pending) return;
          try {
            const blob: Blob = pending.file ?? (await fetch(pending.url).then((r) => r.blob()));
            await library.upload(blob, pending.name, { title, startProcessing });
            setUploadError(null);
            clear();
          } catch (err) {
            setUploadError(err instanceof Error ? err.message : String(err));
          }
        }}
      />
    </AppShell>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  );
}
