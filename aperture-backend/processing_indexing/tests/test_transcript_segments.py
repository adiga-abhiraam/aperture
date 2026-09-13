"""Parsing Gemini transcript segments must survive the odd bad timestamp."""

from __future__ import annotations

from pathlib import Path

import pytest

from processing_indexing.gemini_transcription import (
    GeminiMediaClip,
    GeminiStructuredOutputError,
    _parse_transcript_segments,
)


def _chunk(tmp_path: Path) -> GeminiMediaClip:
    path = tmp_path / "chunk.mp3"
    path.write_bytes(b"\x00" * 16)
    return GeminiMediaClip(path, "audio/mpeg", 120, 240, "audio")


def test_zero_length_and_reversed_segments_keep_their_words(tmp_path: Path) -> None:
    payload = {
        "segments": [
            {"start_seconds": 1.0, "end_seconds": 4.0, "text": "namaste"},
            {"start_seconds": 5.0, "end_seconds": 5.0, "text": "haan"},
            {"start_seconds": 9.0, "end_seconds": 8.0, "text": "bilkul"},
            {"start_seconds": 10.0, "end_seconds": 12.0, "text": "theek hai"},
        ]
    }
    segments = _parse_transcript_segments(payload, _chunk(tmp_path))
    assert [s.text for s in segments] == ["namaste", "haan", "bilkul", "theek hai"]
    # Repaired segments get a short nominal duration at their start, offset by the chunk.
    assert (segments[1].start, segments[1].end) == (125.0, 125.5)
    assert (segments[2].start, segments[2].end) == (129.0, 129.5)


def test_segment_past_the_chunk_end_is_dropped_not_fatal(tmp_path: Path) -> None:
    payload = {"segments": [{"start_seconds": 121.0, "end_seconds": 121.0, "text": "late"}]}
    assert _parse_transcript_segments(payload, _chunk(tmp_path)) == []


def test_non_numeric_timestamps_are_still_rejected(tmp_path: Path) -> None:
    payload = {"segments": [{"start_seconds": "1", "end_seconds": 2, "text": "x"}]}
    with pytest.raises(GeminiStructuredOutputError):
        _parse_transcript_segments(payload, _chunk(tmp_path))
