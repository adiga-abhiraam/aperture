"""Reusable uploads: a large file is uploaded once per client and referenced again."""

from __future__ import annotations

import json
from pathlib import Path

from processing_indexing.gemini_runtime import GoogleGenAIRuntime


class _Upload:
    def __init__(self, name: str) -> None:
        self.name = name
        self.state = "ACTIVE"


class _Files:
    def __init__(self, log: list[str], *, expire_after_get: bool = False) -> None:
        self.log = log
        self.counter = 0
        self.expire_after_get = expire_after_get
        self.gets = 0

    def upload(self, *, file, config):
        self.counter += 1
        self.log.append(f"upload:{Path(file).name}")
        return _Upload(f"files/{self.counter}")

    def get(self, *, name):
        self.gets += 1
        if self.expire_after_get:
            raise RuntimeError("404 file expired")
        return _Upload(name)

    def delete(self, *, name):
        self.log.append(f"delete:{name}")


class _Response:
    text = json.dumps({"answer": "ok"})


class _Models:
    def __init__(self, log: list[str]) -> None:
        self.log = log

    def generate_content(self, *, model, contents, config):
        refs = [getattr(part, "name", "inline") for part in contents[1:]]
        self.log.append("generate:" + ",".join(refs))
        return _Response()


class _Client:
    def __init__(self, log: list[str], **kwargs) -> None:
        self.files = _Files(log, **kwargs)
        self.models = _Models(log)


class _Part:
    @staticmethod
    def from_bytes(*, data, mime_type):
        return "inline-part"


class _Types:
    Part = _Part

    class UploadFileConfig:
        def __init__(self, mime_type=None):
            self.mime_type = mime_type

    class GenerateContentConfig:
        def __init__(self, **kwargs):
            pass


def _runtime(client: _Client) -> GoogleGenAIRuntime:
    return GoogleGenAIRuntime(client=client, types_module=_Types, reuse_uploads=True)


def _big(tmp_path: Path, name: str = "clip.mp4") -> Path:
    path = tmp_path / name
    path.write_bytes(b"\x00" * (GoogleGenAIRuntime.REUSABLE_MEDIA_MIN_BYTES + 1))
    return path


def test_large_file_is_uploaded_once_and_never_deleted(tmp_path: Path) -> None:
    log: list[str] = []
    runtime = _runtime(_Client(log))
    video = _big(tmp_path)
    for _ in range(3):
        runtime.generate_json(model="m", prompt="q", media_path=video, media_mime_type="video/mp4")
    assert log.count("upload:clip.mp4") == 1
    assert log.count("generate:files/1") == 3
    assert not any(entry.startswith("delete:") for entry in log)


def test_small_media_stays_inline_and_is_not_cached(tmp_path: Path) -> None:
    log: list[str] = []
    runtime = _runtime(_Client(log))
    photo = tmp_path / "ref.jpg"
    photo.write_bytes(b"\xff" * 100)
    runtime.generate_json(model="m", prompt="q", media_path=photo, media_mime_type="image/jpeg")
    assert log == ["generate:inline"]


def test_warm_then_generate_reuses_the_warm_upload(tmp_path: Path) -> None:
    log: list[str] = []
    runtime = _runtime(_Client(log))
    video = _big(tmp_path)
    assert runtime.warm_media(video, "video/mp4") is True
    runtime.generate_json(model="m", prompt="q", media_path=video, media_mime_type="video/mp4")
    assert log == ["upload:clip.mp4", "generate:files/1"]


def test_expired_upload_is_replaced(tmp_path: Path) -> None:
    log: list[str] = []
    client = _Client(log, expire_after_get=True)
    runtime = _runtime(client)
    video = _big(tmp_path)
    runtime.generate_json(model="m", prompt="q", media_path=video, media_mime_type="video/mp4")
    runtime.generate_json(model="m", prompt="q", media_path=video, media_mime_type="video/mp4")
    # Second call checked the cached file, found it gone, and uploaded again.
    assert log.count("upload:clip.mp4") == 2
    assert log[-1] == "generate:files/2"


def test_reuse_off_keeps_upload_and_delete_per_request(tmp_path: Path) -> None:
    log: list[str] = []
    runtime = GoogleGenAIRuntime(client=_Client(log), types_module=_Types)
    video = tmp_path / "clip.mp4"
    video.write_bytes(b"\x00" * (GoogleGenAIRuntime.INLINE_MEDIA_MAX_BYTES + 1))
    runtime.generate_json(model="m", prompt="q", media_path=video, media_mime_type="video/mp4")
    runtime.generate_json(model="m", prompt="q", media_path=video, media_mime_type="video/mp4")
    assert log.count("upload:clip.mp4") == 2
    assert log.count("delete:files/1") == 1 and log.count("delete:files/2") == 1


def test_every_request_starts_with_a_unique_tag_with_and_without_media(tmp_path: Path) -> None:
    """Gemini bounces repeated prompt prefixes with a generic 429; each request
    must open with a fresh tag, also when media follows the prompt."""
    seen: list[str] = []

    class _RecordingModels(_Models):
        def generate_content(self, *, model, contents, config):
            text = contents if isinstance(contents, str) else contents[0]
            seen.append(text)
            return _Response()

    client = _Client([])
    client.models = _RecordingModels([])
    runtime = GoogleGenAIRuntime(client=client, types_module=_Types)
    photo = tmp_path / "ref.jpg"
    photo.write_bytes(b"\xff" * 100)
    runtime.generate_json(model="m", prompt="Describe the clip.", media_path=photo, media_mime_type="image/jpeg")
    runtime.generate_json(model="m", prompt="Describe the clip.", media_path=photo, media_mime_type="image/jpeg")
    runtime.generate_json(model="m", prompt="Describe the clip.")
    assert all(text.startswith("Request ") and text.endswith("\nDescribe the clip.") for text in seen)
    assert len({text.split("\n")[0] for text in seen}) == 3
