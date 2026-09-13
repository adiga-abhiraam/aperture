"""Structured Gemini Flash-Lite adapters for API-based indexing and search.

These adapters deliberately return ordinary Python dataclasses and reuse the
repository's ``TranscriptSegment`` model.  They can be called by a job runner,
the query API, or tests with a fake ``GeminiJsonRuntime``; none of them reads
environment variables or creates a Google client itself.
"""

from __future__ import annotations

import math
import random
from collections.abc import Callable, Mapping, Sequence
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .gemini_runtime import (
    GeminiCallDiagnostics,
    GeminiInputError,
    GeminiJsonRuntime,
    GeminiResponseError,
)
from .models import TranscriptSegment, VideoWindow

GEMINI_FLASH_LITE_MODEL = "gemini-3.5-flash-lite"


class GeminiStructuredOutputError(GeminiResponseError):
    """A valid JSON response that does not meet the requested contract."""


@dataclass(frozen=True)
class GeminiMediaClip:
    """One locally prepared media segment uploaded to Gemini on demand."""

    path: Path
    mime_type: str
    start_seconds: float
    end_seconds: float
    kind: str

    def __post_init__(self) -> None:
        if self.kind not in {"video", "audio"}:
            raise ValueError("Gemini media clip kind must be 'video' or 'audio'")
        if not self.mime_type.strip():
            raise ValueError("Gemini media clip must have a MIME type")
        if not self.path.is_file():
            raise GeminiInputError(f"prepared media file does not exist: {self.path}")
        if not all(math.isfinite(value) for value in (self.start_seconds, self.end_seconds)):
            raise ValueError("Gemini media times must be finite")
        if self.start_seconds < 0 or self.end_seconds <= self.start_seconds:
            raise ValueError("Gemini media clip end must be after start")

    @property
    def duration_seconds(self) -> float:
        return self.end_seconds - self.start_seconds


@dataclass(frozen=True)
class GeminiTranscriptionResult:
    segments: tuple[TranscriptSegment, ...]
    diagnostics: tuple[GeminiCallDiagnostics, ...]
    model: str
    chunk_count: int


@dataclass(frozen=True)
class SoundEvent:
    """A non-speech sound the model heard, in absolute video seconds."""

    label: str
    start: float
    end: float
    confidence: float


@dataclass(frozen=True)
class GeminiSoundEventResult:
    events: tuple[SoundEvent, ...]
    diagnostics: tuple[GeminiCallDiagnostics, ...]
    model: str
    chunk_count: int


@dataclass(frozen=True)
class GeminiCaptionResult:
    caption: str
    confidence: float
    evidence: tuple[str, ...]
    diagnostics: GeminiCallDiagnostics
    model: str


@dataclass(frozen=True)
class GeminiQueryPlan:
    """Separate query text to embed/search per modality; never raw-vector fusion."""

    expanded_query: str
    visual_query: str
    audio_query: str
    transcript_query: str
    caption_query: str
    diagnostics: GeminiCallDiagnostics
    model: str

    def by_modality(self) -> dict[str, str]:
        return {
            "visual": self.visual_query,
            "audio": self.audio_query,
            "transcript": self.transcript_query,
            "caption": self.caption_query,
        }


_TRANSCRIPTION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "segments": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "start_seconds": {"type": "number"},
                    "end_seconds": {"type": "number"},
                    "text": {"type": "string"},
                },
                "required": ["start_seconds", "end_seconds", "text"],
            },
        }
    },
    "required": ["segments"],
}

_SOUND_EVENT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "events": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "label": {"type": "string"},
                    "start_seconds": {"type": "number"},
                    "end_seconds": {"type": "number"},
                    "confidence": {"type": "number"},
                },
                "required": ["label", "start_seconds", "end_seconds", "confidence"],
            },
        }
    },
    "required": ["events"],
}

# Labels the model sometimes returns for "nothing notable"; never indexed.
_NON_EVENT_LABELS = {"speech", "talking", "conversation", "silence", "none", "no sound", "background noise", "ambient noise", "quiet"}
MAX_SOUND_EVENTS_PER_CHUNK = 40


_CAPTION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "caption": {"type": "string"},
        "confidence": {"type": "number"},
        "evidence": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["caption", "confidence", "evidence"],
}

_DECOMPOSITION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "expanded_query": {"type": "string"},
        "visual_query": {"type": "string"},
        "audio_query": {"type": "string"},
        "transcript_query": {"type": "string"},
        "caption_query": {"type": "string"},
    },
    "required": [
        "expanded_query",
        "visual_query",
        "audio_query",
        "transcript_query",
        "caption_query",
    ],
}


class GeminiFlashLiteTranscriber:
    """Transcribe non-overlapping locally prepared audio chunks with timestamps."""

    def __init__(
        self,
        runtime: GeminiJsonRuntime,
        *,
        model: str = GEMINI_FLASH_LITE_MODEL,
    ) -> None:
        if not model.strip():
            raise ValueError("Gemini transcription model must not be empty")
        self.runtime = runtime
        self.model = model

    def transcribe_chunks(
        self,
        chunks: Sequence[GeminiMediaClip],
        *,
        progress_callback: Callable[[int, int], None] | None = None,
        concurrency: int = 1,
        should_cancel: Callable[[], bool] | None = None,
    ) -> GeminiTranscriptionResult:
        previous_end = 0.0
        for index, chunk in enumerate(chunks):
            if chunk.kind != "audio":
                raise GeminiInputError("Gemini transcription accepts only audio clips")
            if index and chunk.start_seconds < previous_end:
                raise GeminiInputError(
                    "Gemini transcription chunks must not overlap; timestamps would duplicate"
                )
            previous_end = chunk.end_seconds

        def transcribe_one(chunk: GeminiMediaClip) -> tuple[dict[str, Any], GeminiCallDiagnostics] | None:
            if should_cancel is not None and should_cancel():
                return None
            return self.runtime.generate_json(
                model=self.model,
                prompt=_transcription_prompt(chunk.duration_seconds),
                media_path=chunk.path,
                media_mime_type=chunk.mime_type,
                response_schema=_TRANSCRIPTION_SCHEMA,
                operation_name="transcription",
            )

        segments: list[TranscriptSegment] = []
        diagnostics: list[GeminiCallDiagnostics] = []
        # Chunks are independent (non-overlapping), so they can be sent
        # concurrently; results are consumed in order so timestamps stay sorted.
        with ThreadPoolExecutor(max_workers=max(1, int(concurrency))) as pool:
            futures = [(chunk, pool.submit(transcribe_one, chunk)) for chunk in chunks]
            for index, (chunk, future) in enumerate(futures):
                outcome = future.result()
                if outcome is None:
                    continue
                payload, call = outcome
                diagnostics.append(call)
                segments.extend(_parse_transcript_segments(payload, chunk))
                if progress_callback is not None:
                    progress_callback(index + 1, len(chunks))
        return GeminiTranscriptionResult(
            segments=tuple(sorted(segments, key=lambda item: (item.start, item.end))),
            diagnostics=tuple(diagnostics),
            model=self.model,
            chunk_count=len(chunks),
        )


def _sound_events_prompt(duration_seconds: float) -> str:
    return _compose(
        f"This audio clip is {duration_seconds:g} seconds long and starts at 0. Listen for "
        "distinct NON-SPEECH sound events that a security or archive operator would want "
        "to find later: sirens, alarms, car or bike horns, engine revving or screeching "
        "tyres, crashes or impacts, glass breaking, gunshots or bangs, explosions, screams "
        "or shouting, crying, dog barking, doors slamming, knocking, footsteps running, "
        "music starting or stopping, applause, laughter, phone ringing, whistles, bells.",
        [
            "For each event give a short lower-case label (e.g. 'police siren', 'car horn', "
            "'glass breaking'), its start and end in seconds within THIS clip, and a confidence "
            "from 0 to 1.",
            "Report each event once with its actual duration.",
            "Do not list ordinary speech, silence, or continuous background hum.",
            "Return an empty list when nothing notable is heard.",
        ],
        "Return only the requested JSON.",
    )


def _parse_sound_events(payload: Mapping[str, Any], chunk: GeminiMediaClip) -> list[SoundEvent]:
    raw_events = payload.get("events")
    if not isinstance(raw_events, list):
        raise GeminiStructuredOutputError("sound event response must contain an events list")
    parsed: list[SoundEvent] = []
    for item in raw_events[:MAX_SOUND_EVENTS_PER_CHUNK]:
        if not isinstance(item, Mapping):
            continue
        label = " ".join(str(item.get("label") or "").lower().split())[:60]
        if not label or label in _NON_EVENT_LABELS:
            continue
        try:
            start = _finite_number(item.get("start_seconds"), "start_seconds")
            end = _finite_number(item.get("end_seconds"), "end_seconds")
        except GeminiStructuredOutputError:
            continue
        if end <= start:
            end = start + _DEGENERATE_SEGMENT_SECONDS
        try:
            confidence = _number_in_range(item.get("confidence", 0.5), "confidence", 0.0, 1.0)
        except GeminiStructuredOutputError:
            confidence = 0.5
        absolute_start = max(chunk.start_seconds, min(chunk.end_seconds, chunk.start_seconds + start))
        absolute_end = max(chunk.start_seconds, min(chunk.end_seconds, chunk.start_seconds + end))
        if absolute_end <= absolute_start:
            continue
        parsed.append(SoundEvent(label=label, start=absolute_start, end=absolute_end, confidence=confidence))
    return parsed


class GeminiFlashLiteSoundEventDetector:
    """Label non-speech sound events in the transcription audio chunks.

    Runs on the same chunks the transcriber already cut, so a 24-minute video
    costs twelve extra calls, and every event carries the exact second it
    starts so the chat can cite "police siren at [03:12]".
    """

    def __init__(self, runtime: GeminiJsonRuntime, *, model: str = GEMINI_FLASH_LITE_MODEL) -> None:
        if not model.strip():
            raise ValueError("Gemini sound-event model must not be empty")
        self.runtime = runtime
        self.model = model

    def detect_chunks(
        self,
        chunks: Sequence[GeminiMediaClip],
        *,
        progress_callback: Callable[[int, int], None] | None = None,
        concurrency: int = 1,
        should_cancel: Callable[[], bool] | None = None,
    ) -> GeminiSoundEventResult:
        def detect_one(chunk: GeminiMediaClip) -> tuple[dict[str, Any], GeminiCallDiagnostics] | None:
            if should_cancel is not None and should_cancel():
                return None
            return self.runtime.generate_json(
                model=self.model,
                prompt=_sound_events_prompt(chunk.duration_seconds),
                media_path=chunk.path,
                media_mime_type=chunk.mime_type,
                response_schema=_SOUND_EVENT_SCHEMA,
                operation_name="sound_events",
            )

        events: list[SoundEvent] = []
        diagnostics: list[GeminiCallDiagnostics] = []
        with ThreadPoolExecutor(max_workers=max(1, int(concurrency))) as pool:
            futures = [(chunk, pool.submit(detect_one, chunk)) for chunk in chunks]
            for index, (chunk, future) in enumerate(futures):
                outcome = future.result()
                if outcome is None:
                    continue
                payload, call = outcome
                diagnostics.append(call)
                events.extend(_parse_sound_events(payload, chunk))
                if progress_callback is not None:
                    progress_callback(index + 1, len(chunks))
        return GeminiSoundEventResult(
            events=tuple(sorted(events, key=lambda item: (item.start, item.end))),
            diagnostics=tuple(diagnostics),
            model=self.model,
            chunk_count=len(chunks),
        )


def sound_events_for_window(events: Sequence[SoundEvent], start: float, end: float) -> list[SoundEvent]:
    """Events overlapping [start, end), in time order."""

    return [event for event in events if event.start < end and event.end > start]


class GeminiFlashLiteCaptioner:
    """Generate evidence-grounded structured captions from one prepared video clip."""

    def __init__(
        self,
        runtime: GeminiJsonRuntime,
        *,
        model: str = GEMINI_FLASH_LITE_MODEL,
    ) -> None:
        if not model.strip():
            raise ValueError("Gemini caption model must not be empty")
        self.runtime = runtime
        self.model = model

    def caption_window(
        self, clip: GeminiMediaClip, window: VideoWindow
    ) -> GeminiCaptionResult:
        if clip.kind != "video":
            raise GeminiInputError("Gemini captions require a prepared video clip")
        if abs(clip.start_seconds - window.start) > 0.01 or abs(clip.end_seconds - window.end) > 0.01:
            raise GeminiInputError("caption clip timestamps must match its video window")
        payload, diagnostics = self.runtime.generate_json(
            model=self.model,
            prompt=_caption_prompt(window),
            media_path=clip.path,
            media_mime_type=clip.mime_type,
            response_schema=_CAPTION_SCHEMA,
            operation_name="caption",
        )
        caption = _required_text(payload, "caption")
        confidence = _number_in_range(payload.get("confidence"), "confidence", 0.0, 1.0)
        evidence_value = payload.get("evidence")
        if not isinstance(evidence_value, list) or not all(
            isinstance(item, str) for item in evidence_value
        ):
            raise GeminiStructuredOutputError("caption evidence must be a list of strings")
        return GeminiCaptionResult(
            caption=caption,
            confidence=confidence,
            evidence=tuple(item.strip() for item in evidence_value if item.strip()),
            diagnostics=diagnostics,
            model=self.model,
        )


class GeminiFlashLiteQueryDecomposer:
    """Expand a user question into independently embeddable modality prompts."""

    def __init__(
        self,
        runtime: GeminiJsonRuntime,
        *,
        model: str = GEMINI_FLASH_LITE_MODEL,
    ) -> None:
        if not model.strip():
            raise ValueError("Gemini query decomposition model must not be empty")
        self.runtime = runtime
        self.model = model

    def decompose(self, query: str) -> GeminiQueryPlan:
        normalized = query.strip()
        if not normalized:
            raise GeminiInputError("search query must not be empty")
        payload, diagnostics = self.runtime.generate_json(
            model=self.model,
            prompt=_decomposition_prompt(normalized),
            response_schema=_DECOMPOSITION_SCHEMA,
            operation_name="query_decomposition",
        )
        return GeminiQueryPlan(
            expanded_query=_required_text(payload, "expanded_query"),
            visual_query=_required_text(payload, "visual_query"),
            audio_query=_required_text(payload, "audio_query"),
            transcript_query=_required_text(payload, "transcript_query"),
            caption_query=_required_text(payload, "caption_query"),
            diagnostics=diagnostics,
            model=self.model,
        )


def _compose(context: str, instructions: Sequence[str], closing: str) -> str:
    """Context first, independent instructions in a random order, closing last.

    Gemini's free tier fingerprints prompt text and bounces near-duplicates
    with a generic 429 once too many similar requests arrive per minute; a
    job sends hundreds of prompts built from one template, so varying the
    order of instructions that do not depend on each other keeps them apart
    without changing what is asked.
    """

    body = list(instructions)
    random.shuffle(body)
    return " ".join([context, *body, closing])


def _transcription_prompt(duration_seconds: float) -> str:
    return _compose(
        f"Transcribe only the audible speech in this {duration_seconds:g}-second audio clip.",
        [
            "Timestamp each segment in seconds relative to the start of this clip.",
            "Do not invent speech.",
            "If there is no intelligible speech, return an empty segments array.",
        ],
        "Return JSON matching the supplied schema.",
    )


def _caption_prompt(window: VideoWindow) -> str:
    length = max(0.0, window.end - window.start)
    return _compose(
        "You are given one short clip cut from a longer video. The clip is "
        f"{length:g} seconds long and starts at 0; in the full video it covers "
        f"{window.start:g}s-{window.end:g}s.",
        [
            "Do NOT mention any timestamps.",
            "Describe everything visible in the clip in 2-4 plain sentences: the setting, "
            "people or animals (appearance, clothing, what they do), objects, on-screen text, "
            "camera moves, and how the scene changes from the start of the clip to its end.",
            "In `evidence`, list 3-8 short noun/verb phrases for the most specific visible "
            "details (e.g. 'white piglet on a towel', 'hand scratching belly').",
            "Do not infer sound, intent, identity, or anything outside the clip.",
        ],
        "Return only the requested JSON.",
    )


def _decomposition_prompt(query: str) -> str:
    return (
        "Expand this surveillance-video search request into four short, independently "
        "searchable prompts. visual_query describes visible entities/actions; "
        "audio_query describes audible events; transcript_query describes likely spoken "
        "words; caption_query describes scene evidence. Keep unsupported modalities "
        "useful but neutral rather than inventing facts. Return only structured JSON. "
        f"User query: {query}"
    )


# Nominal length given to a segment whose end is not after its start.
_DEGENERATE_SEGMENT_SECONDS = 0.5


def _parse_transcript_segments(
    payload: Mapping[str, Any], chunk: GeminiMediaClip
) -> list[TranscriptSegment]:
    raw_segments = payload.get("segments")
    if not isinstance(raw_segments, list):
        raise GeminiStructuredOutputError("transcription response must contain a segments list")
    parsed: list[TranscriptSegment] = []
    for item in raw_segments:
        if not isinstance(item, Mapping):
            raise GeminiStructuredOutputError("every transcript segment must be an object")
        start = _finite_number(item.get("start_seconds"), "start_seconds")
        end = _finite_number(item.get("end_seconds"), "end_seconds")
        text = _required_text(item, "text")
        if end <= start:
            # Long, fast, overlapping speech makes the model emit the odd
            # zero-length or reversed segment.  The words are still real, so
            # keep them with a short nominal duration instead of failing the
            # whole video for one bad timestamp.
            end = start + _DEGENERATE_SEGMENT_SECONDS
        absolute_start = max(chunk.start_seconds, min(chunk.end_seconds, chunk.start_seconds + start))
        absolute_end = max(chunk.start_seconds, min(chunk.end_seconds, chunk.start_seconds + end))
        if absolute_end <= absolute_start:
            # A model can occasionally emit a timestamp fractionally outside a
            # clip. Ignore the empty portion rather than inventing a range.
            continue
        parsed.append(
            TranscriptSegment(start=absolute_start, end=absolute_end, text=text)
        )
    return parsed


def _finite_number(value: Any, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (float, int)):
        raise GeminiStructuredOutputError(f"{name} must be a number")
    number = float(value)
    if not math.isfinite(number):
        raise GeminiStructuredOutputError(f"{name} must be finite")
    return number


def _number_in_range(value: Any, name: str, low: float, high: float) -> float:
    number = _finite_number(value, name)
    if not low <= number <= high:
        raise GeminiStructuredOutputError(f"{name} must be between {low:g} and {high:g}")
    return number


def _required_text(payload: Mapping[str, Any], name: str) -> str:
    value = payload.get(name)
    if not isinstance(value, str) or not value.strip():
        raise GeminiStructuredOutputError(f"{name} must be a non-empty string")
    return value.strip()
