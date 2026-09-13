"""Sound-event detection: parsing, window assignment, pipeline payloads, chat citations."""

from __future__ import annotations

from pathlib import Path

from processing_indexing import video_chat
from processing_indexing.api_pipeline import ApiGeminiProcessingPipeline, ApiPipelineSettings
from processing_indexing.gemini_embeddings import GeminiEmbedding2Adapter
from processing_indexing.gemini_transcription import (
    GeminiFlashLiteCaptioner,
    GeminiFlashLiteSoundEventDetector,
    GeminiFlashLiteTranscriber,
    GeminiMediaClip,
    SoundEvent,
    _parse_sound_events,
    sound_events_for_window,
)
from processing_indexing.tests.test_api_pipeline import (
    FakeEmbeddingTransport,
    FakeGeminiRuntime,
    FakeMediaPreparer,
    _diagnostics,
)


def _chunk(tmp_path: Path, start: float = 120.0, end: float = 240.0) -> GeminiMediaClip:
    path = tmp_path / f"chunk-{int(start)}.mp3"
    path.write_bytes(b"\x00" * 16)
    return GeminiMediaClip(path, "audio/mpeg", start, end, "audio")


def test_parse_sound_events_offsets_by_chunk_and_drops_non_events(tmp_path: Path) -> None:
    payload = {
        "events": [
            {"label": "Police Siren", "start_seconds": 12.0, "end_seconds": 20.0, "confidence": 0.9},
            {"label": "speech", "start_seconds": 0, "end_seconds": 100, "confidence": 1},
            {"label": "car horn", "start_seconds": 50.0, "end_seconds": 50.0, "confidence": 2.0},
            {"label": "", "start_seconds": 1, "end_seconds": 2, "confidence": 0.5},
            {"label": "glass breaking", "start_seconds": "x", "end_seconds": 2, "confidence": 0.5},
        ]
    }
    events = _parse_sound_events(payload, _chunk(tmp_path))
    assert [e.label for e in events] == ["police siren", "car horn"]
    assert (events[0].start, events[0].end, events[0].confidence) == (132.0, 140.0, 0.9)
    # Zero-length keeps a nominal duration; out-of-range confidence falls back.
    assert (events[1].start, events[1].end, events[1].confidence) == (170.0, 170.5, 0.5)


def test_sound_events_for_window_uses_overlap() -> None:
    events = [SoundEvent("siren", 132.0, 140.0, 0.9), SoundEvent("horn", 170.0, 170.5, 0.5)]
    assert [e.label for e in sound_events_for_window(events, 130, 140)] == ["siren"]
    assert [e.label for e in sound_events_for_window(events, 140, 150)] == []
    assert [e.label for e in sound_events_for_window(events, 165, 175)] == ["horn"]


class SoundAwareRuntime(FakeGeminiRuntime):
    def generate_json(self, **kwargs):
        if kwargs["operation_name"] == "sound_events":
            self.calls.append(kwargs)
            # Second chunk (30-45 s) hears a horn 2 s in → absolute 32 s.
            events = [{"label": "car horn", "start_seconds": 2.0, "end_seconds": 3.5, "confidence": 0.8}] if "00001" in kwargs["media_path"].name else []
            return {"events": events}, _diagnostics(kwargs["model"], "sound_events")
        return super().generate_json(**kwargs)


def test_pipeline_attaches_sound_events_to_overlapping_windows(tmp_path: Path) -> None:
    source = tmp_path / "input.webm"
    source.write_bytes(b"source")
    runtime = SoundAwareRuntime()
    pipeline = ApiGeminiProcessingPipeline(
        media_preparer=FakeMediaPreparer(tmp_path),
        embeddings=GeminiEmbedding2Adapter(FakeEmbeddingTransport()),
        transcriber=GeminiFlashLiteTranscriber(runtime),
        captioner=GeminiFlashLiteCaptioner(runtime),
        sound_detector=GeminiFlashLiteSoundEventDetector(runtime),
        settings=ApiPipelineSettings(transcription_chunk_seconds=30),
    )
    report = pipeline.process_video(source, video_id="video-123", duration_seconds=45, has_audio=True)

    # One detection call per transcription chunk, no extra media preparation.
    assert sum(1 for call in runtime.calls if call["operation_name"] == "sound_events") == 2
    by_window = {record.payload["window_index"]: record.payload["sound_events"] for record in report.records}
    # Windows 20-40 and 30-45 overlap the horn at 32-33.5 s; 0-20 and 10-30 do not.
    assert by_window[0] == [] and by_window[1] == []
    assert by_window[2] == [{"label": "car horn", "start": 32.0, "end": 33.5, "confidence": 0.8}]
    assert by_window[3] == by_window[2]
    assert report.provider_calls["sound_events"] == 2


def test_chat_evidence_lists_sounds_and_cites_their_exact_second() -> None:
    windows = [
        {"index": 2, "window_id": "w2", "start": 20, "end": 40, "transcript": "", "caption": "street", "provenance": "direct",
         "sound_events": [{"label": "car horn", "start": 32.0, "end": 33.5, "confidence": 0.8}]},
    ]
    context = video_chat.build_context(windows, "any horn?")
    assert "sounds: car horn at 00:32-00:33" in context

    payload = {"answer": "A car horn sounds at [00:32].", "citations": [{"start_seconds": 32}], "found_in_video": True}
    [citation] = video_chat._citations(payload, payload["answer"], windows, 45)
    assert (citation["start"], citation["label"], citation["kind"], citation["snippet"]) == (32.0, "00:32", "audio", "car horn")
