"""Grounded question answering over one processed video.

The watch page's chat is not free-form: the model only sees the transcript
and captions the pipeline produced for this job, and is asked to cite the
timestamps it used.  That keeps answers checkable (every citation seeks the
player) and means a video with no matching content gets "not in this video"
rather than an invented reply.

Chat history is persisted next to the job (``chat.json``) so it survives a
reload or a backend restart, like the rest of the job's artifacts.
"""

from __future__ import annotations

import json
import os
import re
import threading
import time
from collections.abc import Mapping, Sequence
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

from .gemini_runtime import GeminiKeyPool, GoogleGenAIRuntime, parse_gemini_keys_json

CHAT_FILE = "chat.json"
# Override with CHAT_MODEL in .env; falls back to the quick-demo model, then this.
DEFAULT_CHAT_MODEL = "gemini-3.1-flash-lite"
# Keep the grounding context comfortably inside the model's window while
# leaving room for the history and the answer.
MAX_CONTEXT_CHARS = 48_000
MAX_HISTORY_TURNS = 8
MAX_STORED_MESSAGES = 200

_TIMESTAMP_RE = re.compile(r"\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]")
_WORD_RE = re.compile(r"[a-z0-9]{3,}")

_ANSWER_SCHEMA: Mapping[str, Any] = {
    "type": "object",
    "properties": {
        "answer": {"type": "string"},
        "citations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "start_seconds": {"type": "number"},
                    "reason": {"type": "string"},
                },
                "required": ["start_seconds"],
            },
        },
        "found_in_video": {"type": "boolean"},
    },
    "required": ["answer", "citations", "found_in_video"],
}


# What the model extracts from a reference photo before the footage is
# searched.  ``search_query`` is the phrasing used to look the subject up in
# the transcript/caption evidence; the rest is shown back to the user.
_REFERENCE_SCHEMA: Mapping[str, Any] = {
    "type": "object",
    "properties": {
        "subject": {"type": "string"},
        "description": {"type": "string"},
        "distinguishing_marks": {"type": "array", "items": {"type": "string"}},
        "search_query": {"type": "string"},
    },
    "required": ["subject", "description", "distinguishing_marks", "search_query"],
}

# Image types the chat accepts as a reference photo, keyed by suffix.
IMAGE_MIME: Mapping[str, str] = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
}
MAX_REFERENCE_IMAGE_BYTES = 10 * 1024 * 1024
DEFAULT_IMAGE_QUESTION = "When does this appear in the video, and what happens to it?"


class VideoChatError(RuntimeError):
    """A user-facing chat failure that carries no credentials."""


def chat_model_name() -> str:
    return (os.environ.get("CHAT_MODEL") or os.environ.get("QUICK_DEMO_MODEL") or DEFAULT_CHAT_MODEL).strip()


def env_gemini_runtime() -> GoogleGenAIRuntime:
    """Build a Gemini runtime from the backend's own environment keys."""

    pool_raw = os.environ.get("GEMINI_API_KEYS_JSON", "").strip()
    if pool_raw and pool_raw != "[]":
        try:
            keys = parse_gemini_keys_json(pool_raw)
        except Exception:  # noqa: BLE001 - fall through to the single key
            keys = ()
        if keys:
            return GoogleGenAIRuntime(key_pool=GeminiKeyPool(keys))
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not key:
        raise VideoChatError(
            "No Gemini API key is configured. Set GEMINI_API_KEY (or GEMINI_API_KEYS_JSON) in .env."
        )
    return GoogleGenAIRuntime(api_key=key)


_FOOTAGE_RUNTIME: GoogleGenAIRuntime | None = None
_FOOTAGE_RUNTIME_LOCK = threading.Lock()


def env_footage_runtime() -> GoogleGenAIRuntime:
    """The runtime that watches whole videos: one process-wide instance on a
    single key, so its upload cache is shared by every question and page load.

    Uploaded files belong to the key that uploaded them, which is why this
    does not rotate through the pool like the light-weight calls do."""

    global _FOOTAGE_RUNTIME
    with _FOOTAGE_RUNTIME_LOCK:
        if _FOOTAGE_RUNTIME is None:
            key = os.environ.get("GEMINI_API_KEY", "").strip()
            if not key:
                pool_raw = os.environ.get("GEMINI_API_KEYS_JSON", "").strip()
                try:
                    key = parse_gemini_keys_json(pool_raw)[0] if pool_raw and pool_raw != "[]" else ""
                except Exception:  # noqa: BLE001 - reported below
                    key = ""
            if not key:
                raise VideoChatError(
                    "No Gemini API key is configured. Set GEMINI_API_KEY (or GEMINI_API_KEYS_JSON) in .env."
                )
            _FOOTAGE_RUNTIME = GoogleGenAIRuntime(api_key=key, reuse_uploads=True)
        return _FOOTAGE_RUNTIME


def warm_footage(video_path: Path | None, duration_seconds: float) -> bool:
    """Upload the video ahead of the first question; True when it is ready."""

    mime = _video_fallback_allowed(video_path, duration_seconds)
    if mime is None or video_path is None:
        return False
    return env_footage_runtime().warm_media(video_path, mime)


def format_timestamp(seconds: float) -> str:
    total = max(0, int(seconds))
    hours, rest = divmod(total, 3600)
    minutes, secs = divmod(rest, 60)
    if hours:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


def _dedupe_transcript(windows: Sequence[Mapping[str, Any]]) -> dict[int, str]:
    """Overlapping windows repeat text; keep a clean tiling plus new phrases."""

    ordered = sorted(windows, key=lambda w: int(w.get("index", 0)))
    kept: dict[int, str] = {}
    last = ""
    for row in ordered:
        text = str(row.get("transcript") or "").strip()
        if not text:
            continue
        index = int(row.get("index", 0))
        is_tile = index % 2 == 0
        is_new = text not in last and last not in text
        if is_tile or is_new:
            kept[index] = text
            last = text
    return kept


def _lines_for_windows(windows: Sequence[Mapping[str, Any]]) -> list[tuple[int, float, str]]:
    transcript_by_index = _dedupe_transcript(windows)
    lines: list[tuple[int, float, str]] = []
    for row in sorted(windows, key=lambda w: int(w.get("index", 0))):
        index = int(row.get("index", 0))
        start = float(row.get("start", 0.0))
        end = float(row.get("end", start))
        parts: list[str] = []
        transcript = transcript_by_index.get(index)
        if transcript:
            parts.append(f'speech: "{transcript}"')
        caption = str(row.get("caption") or "").strip()
        provenance = str(row.get("provenance") or row.get("vlm_call_state") or "")
        if caption and caption != "[CAPTION UNAVAILABLE]" and provenance == "direct":
            evidence = [str(item).strip() for item in (row.get("caption_evidence") or []) if str(item).strip()]
            detail = f" (details: {'; '.join(evidence[:8])})" if evidence else ""
            parts.append(f"scene: {caption}{detail}")
        sounds = _sound_lines(row)
        if sounds:
            parts.append("sounds: " + "; ".join(sounds))
        if not parts:
            continue
        lines.append((index, start, f"[{format_timestamp(start)}-{format_timestamp(end)}] " + " | ".join(parts)))
    return lines


def _sound_lines(row: Mapping[str, Any]) -> list[str]:
    """'police siren at 03:12-03:20' for each labelled sound in a window."""

    lines: list[str] = []
    for event in row.get("sound_events") or []:
        if not isinstance(event, Mapping):
            continue
        label = str(event.get("label") or "").strip()
        if not label:
            continue
        try:
            start = float(event.get("start", 0.0))
            end = float(event.get("end", start))
        except (TypeError, ValueError):
            continue
        lines.append(f"{label} at {format_timestamp(start)}-{format_timestamp(end)}")
    return lines


def _select_lines(
    lines: Sequence[tuple[int, float, str]], question: str, budget: int
) -> list[tuple[int, float, str]]:
    """Fit the context budget: keep the most question-relevant lines plus an even sample."""

    total = sum(len(line[2]) + 1 for line in lines)
    if total <= budget:
        return list(lines)
    terms = set(_WORD_RE.findall(question.lower()))
    scored = []
    for position, line in enumerate(lines):
        words = set(_WORD_RE.findall(line[2].lower()))
        overlap = len(terms & words)
        scored.append((overlap, position))
    keep: set[int] = set()
    used = 0
    # Relevant lines first, then an even sample so summaries still see the whole video.
    for overlap, position in sorted(scored, key=lambda item: (-item[0], item[1])):
        if overlap == 0:
            break
        cost = len(lines[position][2]) + 1
        if used + cost > budget * 0.7:
            break
        keep.add(position)
        used += cost
    step = max(1, len(lines) // max(1, (budget - used) // 160))
    for position in range(0, len(lines), step):
        cost = len(lines[position][2]) + 1
        if position in keep:
            continue
        if used + cost > budget:
            break
        keep.add(position)
        used += cost
    return [lines[position] for position in sorted(keep)]


def build_context(windows: Sequence[Mapping[str, Any]], question: str, *, budget: int = MAX_CONTEXT_CHARS) -> str:
    lines = _select_lines(_lines_for_windows(windows), question, budget)
    return "\n".join(line[2] for line in lines)


def _history_block(history: Sequence[Mapping[str, Any]]) -> str:
    """Render recent turns; a turn that carried a photo keeps its description
    so follow-ups like "and the other one?" still know what was shown."""

    turns = []
    for message in list(history)[-MAX_HISTORY_TURNS:]:
        role = "User" if message.get("role") == "user" else "Assistant"
        content = str(message.get("content") or "").strip()
        reference = message.get("reference")
        if isinstance(reference, Mapping) and reference.get("description"):
            content = f"{content} (attached photo: {str(reference.get('description')).strip()})".strip()
        turns.append(f"{role}: {content}")
    return "\n".join(turns) if turns else "(no earlier messages)"


def _reference_block(reference: Mapping[str, Any] | None) -> str:
    if not reference:
        return ""
    marks = [str(item).strip() for item in (reference.get("distinguishing_marks") or []) if str(item).strip()]
    lines = [
        "The user attached a reference photo. It shows this exact subject:",
        f"- Subject: {str(reference.get('subject') or '').strip()}",
        f"- Description: {str(reference.get('description') or '').strip()}",
    ]
    if marks:
        lines.append(f"- Distinguishing marks: {'; '.join(marks)}")
    lines.append(
        "Other similar-looking people, objects or vehicles may appear; only report the one "
        "that matches these marks, and say when you are not sure it is the same one."
    )
    return "\n".join(lines) + "\n\n"


def _prompt(
    *,
    title: str,
    duration_seconds: float,
    context: str,
    history: Sequence[Mapping[str, str]],
    question: str,
    reference: Mapping[str, Any] | None = None,
) -> str:
    history_block = _history_block(history)
    return (
        "You are the assistant for one specific video. Answer the user's question using ONLY the "
        "time-stamped evidence below, which was extracted from the video (speech transcript and "
        "scene descriptions).\n"
        f"Video title: {title}\n"
        f"Video length: {format_timestamp(duration_seconds)}\n\n"
        "Rules:\n"
        "- Be concise and direct. Plain text only, no markdown headings.\n"
        "- Whenever you refer to a moment, cite it inline as [mm:ss] using the start time of the "
        "evidence line you used, and also list it in `citations`. For a sound event, cite the "
        "second the sound itself starts (from its own 'at mm:ss' time), not the window start.\n"
        "- 'sounds:' entries are non-speech sounds detected in the audio (sirens, horns, "
        "alarms, crashes, screams...). Use them to answer questions about what was heard.\n"
        "- If the evidence does not contain the answer, say so plainly and set found_in_video to "
        "false. Never invent details that are not in the evidence.\n"
        "- For summaries or 'what happens' questions, walk through the video in order with a few "
        "timestamps.\n\n"
        f"Evidence:\n{context if context else '(no transcript or scene descriptions were produced for this video)'}\n\n"
        f"{_reference_block(reference)}"
        f"Conversation so far:\n{history_block}\n\n"
        f"User: {question.strip()}"
    )


def _nearest_window(windows: Sequence[Mapping[str, Any]], seconds: float) -> Mapping[str, Any] | None:
    best: Mapping[str, Any] | None = None
    best_distance = float("inf")
    ordered = sorted(windows, key=lambda row: float(row.get("start", 0.0)))
    for position, row in enumerate(ordered):
        start = float(row.get("start", 0.0))
        end = float(row.get("end", start))
        is_last = position == len(ordered) - 1
        # Half-open ranges so a timestamp on a boundary belongs to the window
        # that starts there, not the one that just ended.
        if start <= seconds < end or (is_last and seconds == end):
            return row
        distance = min(abs(seconds - start), abs(seconds - end))
        if distance < best_distance:
            best = row
            best_distance = distance
    return best


def _sound_at(window: Mapping[str, Any], seconds: float, tolerance: float = 1.5) -> Mapping[str, Any] | None:
    """The window's detected sound whose start is within ``tolerance`` of ``seconds``."""

    best: Mapping[str, Any] | None = None
    best_distance = tolerance
    for event in window.get("sound_events") or []:
        if not isinstance(event, Mapping) or not event.get("label"):
            continue
        try:
            distance = abs(float(event.get("start", 0.0)) - seconds)
        except (TypeError, ValueError):
            continue
        if distance <= best_distance:
            best, best_distance = event, distance
    return best


def _citations(
    payload: Mapping[str, Any],
    answer: str,
    windows: Sequence[Mapping[str, Any]],
    duration: float,
    *,
    exact: bool = False,
) -> list[dict[str, Any]]:
    """Citations the player can seek to.

    Evidence-based answers cite window starts, so each citation is the window.
    When the model watched the footage itself (``exact``) its timestamps are
    the real second the thing happens, so the seek target keeps that second
    and the window only lends its description.
    """
    seconds_list: list[tuple[float, str]] = []
    for item in payload.get("citations") or []:
        if not isinstance(item, Mapping):
            continue
        try:
            seconds = float(item.get("start_seconds"))
        except (TypeError, ValueError):
            continue
        seconds_list.append((seconds, str(item.get("reason") or "")))
    for match in _TIMESTAMP_RE.finditer(answer):
        hours_or_minutes, minutes_or_seconds, maybe_seconds = match.groups()
        if maybe_seconds is not None:
            seconds = int(hours_or_minutes) * 3600 + int(minutes_or_seconds) * 60 + int(maybe_seconds)
        else:
            seconds = int(hours_or_minutes) * 60 + int(minutes_or_seconds)
        seconds_list.append((float(seconds), ""))

    citations: list[dict[str, Any]] = []
    seen: set[int] = set()
    for seconds, reason in seconds_list:
        if seconds < 0 or (duration and seconds > duration + 1):
            continue
        window = _nearest_window(windows, seconds)
        if window is None:
            continue
        # A cited second that lines up with a detected sound is the sound's
        # own start: keep it exact and label the citation as something heard.
        sound = _sound_at(window, seconds)
        precise = exact or sound is not None
        key = int(seconds) if precise else int(window.get("index", int(seconds)))
        if key in seen:
            continue
        seen.add(key)
        start = max(0.0, seconds) if precise else float(window.get("start", seconds))
        transcript = str(window.get("transcript") or "").strip()
        caption = str(window.get("caption") or "").strip()
        snippet = reason.strip() or (sound["label"] if sound else "") or transcript or caption
        if sound is not None:
            kind = "audio"
        elif transcript and (not caption or transcript in snippet):
            kind = "transcript"
        else:
            kind = "visual"
        citations.append(
            {
                "window_id": window.get("window_id"),
                "window_index": int(window.get("index", 0)),
                "start": start,
                "end": float(sound["end"]) if sound is not None else float(window.get("end", start)),
                "label": format_timestamp(start),
                "snippet": snippet[:240],
                "kind": kind,
            }
        )
    citations.sort(key=lambda item: item["start"])
    return citations[:8]


# Containers Gemini accepts directly; anything else skips the video fallback.
_VIDEO_MIME = {
    ".mp4": "video/mp4",
    ".m4v": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".mpg": "video/mpeg",
    ".mpeg": "video/mpeg",
    ".wmv": "video/x-ms-wmv",
    ".flv": "video/x-flv",
    ".3gp": "video/3gpp",
}


def _video_fallback_allowed(video_path: Path | None, duration_seconds: float) -> str | None:
    """Return the MIME type when the full video may be sent to the model."""

    if video_path is None or not video_path.is_file():
        return None
    mime = _VIDEO_MIME.get(video_path.suffix.lower())
    if mime is None:
        return None
    try:
        max_mb = float(os.environ.get("CHAT_VIDEO_FALLBACK_MAX_MB", "200"))
        max_minutes = float(os.environ.get("CHAT_VIDEO_FALLBACK_MAX_MINUTES", "40"))
    except ValueError:
        max_mb, max_minutes = 200.0, 40.0
    if max_mb <= 0:
        return None
    if video_path.stat().st_size > max_mb * 1024 * 1024:
        return None
    if duration_seconds and duration_seconds > max_minutes * 60:
        return None
    return mime


def _video_prompt(
    *,
    title: str,
    duration_seconds: float,
    history: Sequence[Mapping[str, str]],
    question: str,
    reference: Mapping[str, Any] | None = None,
) -> str:
    history_block = _history_block(history)
    attachments = (
        "Attached files, in order: 1. the video to search (every timestamp refers to it); "
        "2. the user's reference photo.\n"
        if reference
        else ""
    )
    return (
        "Watch the attached video and answer the user's question about it.\n"
        f"{attachments}"
        f"Video title: {title}\n"
        f"Video length: {format_timestamp(duration_seconds)}\n\n"
        f"{_reference_block(reference)}"
        "Rules:\n"
        "- Be concise and direct. Plain text only, no markdown headings.\n"
        "- Whenever you refer to a moment, cite it inline as [mm:ss] measured from the "
        "start of the video, and list the same moments in `citations` (start_seconds).\n"
        "- If the video genuinely does not contain the answer, say so and set "
        "found_in_video to false. Never invent details.\n\n"
        f"Conversation so far:\n{history_block}\n\n"
        f"User: {question.strip()}"
    )


def _reference_prompt(question: str) -> str:
    return (
        "The user attached this photo to find its subject inside surveillance or archive "
        "footage that may contain other similar-looking people, objects or vehicles. "
        "Describe only the main subject, ignoring the background, in enough detail that "
        "someone could pick it out from look-alikes: type, colours, shape, size cues, "
        "materials, clothing, text, labels, stickers, logos, number plates, damage or wear. "
        "`subject` is a short noun phrase (e.g. 'blue steel water bottle', 'white hatchback'). "
        "`description` is 2-3 plain sentences. `distinguishing_marks` lists 3-8 short phrases "
        "for the details that separate it from similar items (colour, shape, cap, label, "
        "sticker, logo, plate, dent, scratch); never list the background, the surface it is "
        "on, or what is being done to it, since those may differ in the footage. Include any "
        "readable text or plate exactly as written. `search_query` is one line of keywords for "
        "finding it in scene descriptions. Do not guess brands or identities you cannot see.\n"
        f"The user's question about the footage: {question.strip() or DEFAULT_IMAGE_QUESTION}"
    )


def describe_reference_image(
    image: tuple[Path, str],
    *,
    question: str,
    runtime: GoogleGenAIRuntime,
    model: str,
) -> dict[str, Any]:
    """Turn a reference photo into a detailed, search-ready description."""

    path, mime = image
    payload, _diagnostics = runtime.generate_json(
        model=model,
        prompt=_reference_prompt(question),
        media_path=path,
        media_mime_type=mime,
        response_schema=_REFERENCE_SCHEMA,
        operation_name="video_chat_describe_reference",
    )
    marks = [str(item).strip() for item in (payload.get("distinguishing_marks") or []) if str(item).strip()]
    return {
        "subject": str(payload.get("subject") or "").strip()[:120],
        "description": str(payload.get("description") or "").strip()[:1200],
        "distinguishing_marks": marks[:8],
        "search_query": str(payload.get("search_query") or "").strip()[:300],
    }


def answer_question(
    *,
    windows: Sequence[Mapping[str, Any]],
    title: str,
    duration_seconds: float,
    question: str,
    history: Sequence[Mapping[str, str]],
    runtime: GoogleGenAIRuntime | None = None,
    model: str | None = None,
    video_path: Path | None = None,
    reference_image: tuple[Path, str] | None = None,
    footage_runtime: GoogleGenAIRuntime | None = None,
) -> dict[str, Any]:
    if reference_image is not None and not question.strip():
        question = DEFAULT_IMAGE_QUESTION
    if not question.strip():
        raise VideoChatError("Ask a question about the video.")
    if len(question) > 2000:
        raise VideoChatError("Keep questions under 2000 characters.")
    started = time.perf_counter()
    runtime = runtime or env_gemini_runtime()
    # Whole-video calls go through the upload-caching runtime when one is
    # configured; tests and callers without one keep a single runtime.
    footage_runtime = footage_runtime or runtime
    model_name = (model or chat_model_name()).strip()

    # A reference photo is first turned into words: the description is shown
    # back to the user, steers the evidence lookup, and tells the model which
    # of several look-alikes to report when it watches the footage.
    reference: dict[str, Any] | None = None
    if reference_image is not None:
        reference = describe_reference_image(
            reference_image, question=question, runtime=runtime, model=model_name
        )

    lookup = f"{question} {reference['search_query']}" if reference else question
    context = build_context(windows, lookup)

    def ask_evidence():
        return runtime.generate_json(
            model=model_name,
            prompt=_prompt(
                title=title,
                duration_seconds=duration_seconds,
                context=context,
                history=history,
                question=question,
                reference=reference,
            ),
            response_schema=_ANSWER_SCHEMA,
            operation_name="video_chat",
        )

    def watch_footage(mime: str):
        return footage_runtime.generate_json(
            model=model_name,
            prompt=_video_prompt(
                title=title,
                duration_seconds=duration_seconds,
                history=history,
                question=question,
                reference=reference,
            ),
            media_path=video_path,
            media_mime_type=mime,
            extra_media=[reference_image] if reference_image is not None else None,
            response_schema=_ANSWER_SCHEMA,
            operation_name="video_chat_watch",
        )

    # The transcript and captions are a compressed view of the video.  When
    # they cannot answer, let the model look at the footage itself (bounded
    # by size/length so a long archive never gets uploaded per question).
    # Captions never say which of three similar bottles is *this* one, so a
    # reference photo always goes to the footage; both calls then run at once
    # because the footage call is the slow one and does not need the other.
    mime = _video_fallback_allowed(video_path, duration_seconds)
    watch_result = None
    if reference is not None and mime is not None:
        with ThreadPoolExecutor(max_workers=2) as pool:
            evidence_future = pool.submit(ask_evidence)
            watch_future = pool.submit(watch_footage, mime)
            payload, diagnostics = evidence_future.result()
            try:
                watch_result = watch_future.result()
            except Exception:  # noqa: BLE001 - keep the grounded answer if watching fails
                watch_result = None
    else:
        payload, diagnostics = ask_evidence()
    answer = str(payload.get("answer") or "").strip()
    found = bool(payload.get("found_in_video", True))
    source = "transcript"

    if watch_result is None and (not found or not answer) and mime is not None:
        try:
            watch_result = watch_footage(mime)
        except Exception:  # noqa: BLE001 - keep the grounded answer if watching fails
            watch_result = None
    if watch_result is not None:
        video_payload, video_diagnostics = watch_result
        video_answer = str(video_payload.get("answer") or "").strip()
        if video_answer:
            payload, diagnostics = video_payload, video_diagnostics
            answer = video_answer
            found = bool(video_payload.get("found_in_video", True))
            source = "video"

    if not answer:
        answer = "I couldn't produce an answer from this video's transcript and scene descriptions."
    return {
        "answer": answer,
        "found_in_video": found,
        "source": source,
        "reference": reference,
        "citations": _citations(payload, answer, windows, duration_seconds, exact=source == "video"),
        "model": model_name,
        "elapsed_seconds": round(time.perf_counter() - started, 3),
        "context_chars": len(context),
        "attempts": len(getattr(diagnostics, "attempts", []) or []),
    }


class ChatHistoryStore:
    """Per-job chat transcript, persisted as JSON in the job directory."""

    def __init__(self) -> None:
        self._locks: dict[str, threading.Lock] = {}
        self._guard = threading.Lock()

    def _lock(self, job_id: str) -> threading.Lock:
        with self._guard:
            return self._locks.setdefault(job_id, threading.Lock())

    @staticmethod
    def _path(directory: Path) -> Path:
        return directory / CHAT_FILE

    def load(self, job_id: str, directory: Path) -> list[dict[str, Any]]:
        with self._lock(job_id):
            return self._read(directory)

    def _read(self, directory: Path) -> list[dict[str, Any]]:
        path = self._path(directory)
        if not path.is_file():
            return []
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return []
        return [item for item in data if isinstance(item, dict)] if isinstance(data, list) else []

    def append(self, job_id: str, directory: Path, *messages: Mapping[str, Any]) -> list[dict[str, Any]]:
        with self._lock(job_id):
            history = self._read(directory)
            history.extend(dict(message) for message in messages)
            history = history[-MAX_STORED_MESSAGES:]
            try:
                self._path(directory).write_text(json.dumps(history, indent=2), encoding="utf-8")
            except OSError:
                pass
            return history

    def clear(self, job_id: str, directory: Path) -> None:
        with self._lock(job_id):
            try:
                self._path(directory).unlink(missing_ok=True)
            except OSError:
                pass
