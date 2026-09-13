"""The watch-page chat with and without a reference photo."""

from __future__ import annotations

from pathlib import Path

import pytest

from processing_indexing import video_chat


class _Diag:
    attempts: list = []


class FakeRuntime:
    """Records every Gemini call and answers by operation name."""

    def __init__(self, *, found_in_evidence: bool = True) -> None:
        self.calls: list[dict] = []
        self.found_in_evidence = found_in_evidence

    def generate_json(self, **kwargs):
        self.calls.append(kwargs)
        name = kwargs["operation_name"]
        if name == "video_chat_describe_reference":
            return (
                {
                    "subject": "blue steel water bottle",
                    "description": "A tall matte-blue steel bottle with a white screw cap.",
                    "distinguishing_marks": ["white screw cap", "yellow sticker near base"],
                    "search_query": "blue bottle white cap",
                },
                _Diag(),
            )
        if name == "video_chat":
            return (
                {
                    "answer": "From the notes it is picked up at [00:20].",
                    "citations": [{"start_seconds": 20}],
                    "found_in_video": self.found_in_evidence,
                },
                _Diag(),
            )
        if name == "video_chat_watch":
            return (
                {
                    "answer": "Watching the footage, the blue bottle is picked up at [00:35].",
                    "citations": [{"start_seconds": 35, "reason": "hand lifts the blue bottle"}],
                    "found_in_video": True,
                },
                _Diag(),
            )
        raise AssertionError(name)


WINDOWS = [
    {"index": 0, "window_id": "v_0", "start": 0, "end": 10, "transcript": "", "caption": "three bottles on a table", "provenance": "direct"},
    {"index": 2, "window_id": "v_2", "start": 20, "end": 30, "transcript": "", "caption": "a hand reaches for a bottle", "provenance": "direct"},
    {"index": 3, "window_id": "v_3", "start": 30, "end": 40, "transcript": "", "caption": "bottle carried away", "provenance": "direct"},
]


def _video(tmp_path: Path) -> Path:
    path = tmp_path / "clip.mp4"
    path.write_bytes(b"\x00" * 64)
    return path


def _image(tmp_path: Path) -> tuple[Path, str]:
    path = tmp_path / "bottle.jpg"
    path.write_bytes(b"\xff\xd8\xff" + b"\x00" * 16)
    return path, "image/jpeg"


def test_text_question_stays_on_evidence_when_found(tmp_path: Path) -> None:
    runtime = FakeRuntime()
    result = video_chat.answer_question(
        windows=WINDOWS,
        title="Bottles",
        duration_seconds=40,
        question="When is the bottle picked up?",
        history=[],
        runtime=runtime,
        model="fake",
        video_path=_video(tmp_path),
    )
    assert [call["operation_name"] for call in runtime.calls] == ["video_chat"]
    assert result["source"] == "transcript"
    assert result["reference"] is None
    assert result["citations"][0]["window_id"] == "v_2"


def test_reference_photo_is_described_then_watched_with_the_footage(tmp_path: Path) -> None:
    runtime = FakeRuntime()
    image = _image(tmp_path)
    result = video_chat.answer_question(
        windows=WINDOWS,
        title="Bottles",
        duration_seconds=40,
        question="",
        history=[],
        runtime=runtime,
        model="fake",
        video_path=_video(tmp_path),
        reference_image=image,
    )
    names = [call["operation_name"] for call in runtime.calls]
    # The photo is described first; the evidence and footage calls then run concurrently.
    assert names[0] == "video_chat_describe_reference"
    assert sorted(names[1:]) == ["video_chat", "video_chat_watch"]

    by_name = {call["operation_name"]: call for call in runtime.calls}
    describe, grounded, watch = by_name["video_chat_describe_reference"], by_name["video_chat"], by_name["video_chat_watch"]
    assert describe["media_path"] == image[0]
    assert "blue steel water bottle" in grounded["prompt"]
    assert "yellow sticker near base" in grounded["prompt"]
    # The footage call carries the video first and the photo as extra media.
    assert watch["media_path"] == _video(tmp_path)
    assert list(watch["extra_media"]) == [image]
    assert "reference photo" in watch["prompt"]

    assert result["source"] == "video"
    assert result["reference"]["subject"] == "blue steel water bottle"
    # The footage call cited the real second (35 s), so the seek target keeps
    # it instead of snapping to the 30 s window start.
    assert result["citations"][0]["window_id"] == "v_3"
    assert result["citations"][0]["start"] == 35
    assert result["citations"][0]["label"] == "00:35"
    assert result["citations"][0]["snippet"] == "hand lifts the blue bottle"


def test_reference_photo_without_video_file_keeps_grounded_answer(tmp_path: Path) -> None:
    runtime = FakeRuntime()
    result = video_chat.answer_question(
        windows=WINDOWS,
        title="Bottles",
        duration_seconds=40,
        question="where is it?",
        history=[],
        runtime=runtime,
        model="fake",
        video_path=None,
        reference_image=_image(tmp_path),
    )
    assert [call["operation_name"] for call in runtime.calls] == ["video_chat_describe_reference", "video_chat"]
    assert result["source"] == "transcript"
    assert result["citations"][0]["window_id"] == "v_2"


def test_history_keeps_photo_description_for_follow_ups() -> None:
    history = [
        {"role": "user", "content": "when is this picked up?", "reference": {"description": "A tall blue bottle."}},
        {"role": "assistant", "content": "At [00:35]."},
    ]
    block = video_chat._history_block(history)
    assert "when is this picked up? (attached photo: A tall blue bottle.)" in block


def test_empty_question_without_photo_is_rejected() -> None:
    with pytest.raises(video_chat.VideoChatError):
        video_chat.answer_question(
            windows=WINDOWS, title="x", duration_seconds=1, question="  ", history=[], runtime=FakeRuntime(), model="fake"
        )
