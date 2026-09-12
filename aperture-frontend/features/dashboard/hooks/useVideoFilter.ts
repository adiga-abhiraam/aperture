"use client";

import { useCallback, useMemo, useState } from "react";
import { ProcessingStatus, Video } from "@/types/video";
import { filterVideos, SortKey } from "@/lib/filterVideos";

/** Search / status / sort state over an already-loaded list of videos. */
export function useVideoFilter(videos: Video[]) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<ProcessingStatus | "all">("all");
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [layout, setLayout] = useState<"grid" | "list">("grid");

  const filteredVideos = useMemo(
    () => filterVideos(videos, { query: searchQuery, status: selectedStatus, sortBy }),
    [videos, searchQuery, selectedStatus, sortBy]
  );

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedStatus("all");
    setSortBy("newest");
  }, []);

  return {
    filteredVideos,
    searchQuery,
    setSearchQuery,
    selectedStatus,
    setSelectedStatus,
    sortBy,
    setSortBy,
    layout,
    setLayout,
    resetFilters,
  };
}
