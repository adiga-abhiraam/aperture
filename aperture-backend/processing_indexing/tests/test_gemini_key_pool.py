"""Key rotation across the hosted embedding transport and the job pipeline."""

from __future__ import annotations

import pytest

from processing_indexing import debug_jobs
from processing_indexing.api_pipeline import GeminiApiPipelineFactoryConfig, build_gemini_api_pipeline
from processing_indexing.gemini_embeddings import GeminiEmbeddingContent, GoogleGenAIEmbeddingClient
from processing_indexing.gemini_runtime import GeminiKeyPool


class _FakeTypes:
    class EmbedContentConfig:
        def __init__(self, output_dimensionality: int) -> None:
            self.output_dimensionality = output_dimensionality


class _FakeModels:
    def __init__(self, key: str, log: list[str]) -> None:
        self._key = key
        self._log = log

    def embed_content(self, *, model, contents, config):
        self._log.append(self._key)
        return {"embeddings": [{"values": [0.1, 0.2]}]}


class _FakeClient:
    def __init__(self, api_key: str, log: list[str]) -> None:
        self.models = _FakeModels(api_key, log)


def test_embedding_client_rotates_keys_per_call(monkeypatch: pytest.MonkeyPatch) -> None:
    log: list[str] = []

    class _Genai:
        @staticmethod
        def Client(api_key: str):
            return _FakeClient(api_key, log)

    monkeypatch.setattr(
        "processing_indexing.gemini_embeddings._build_google_content", lambda types, content: "x"
    )
    monkeypatch.setattr(
        "processing_indexing.gemini_embeddings._extract_embedding_values", lambda response: [0.1, 0.2]
    )
    client = GoogleGenAIEmbeddingClient(
        key_pool=GeminiKeyPool(["k1", "k2", "k3"]), sdk_loader=lambda: (_Genai, _FakeTypes)
    )
    content = GeminiEmbeddingContent(modality="text", text="hello")
    for _ in range(4):
        client.embed(content, model="m", dimensions=2)
    assert log == ["k1", "k2", "k3", "k1"]


def test_embedding_client_rejects_key_and_pool_together() -> None:
    with pytest.raises(ValueError):
        GoogleGenAIEmbeddingClient(api_key="a", key_pool=GeminiKeyPool(["b"]))


def test_factory_builds_pool_when_extra_keys_given() -> None:
    bundle = build_gemini_api_pipeline(
        GeminiApiPipelineFactoryConfig(gemini_api_key="k1", gemini_api_keys=("k2", "k1", "k3"))
    )
    runtime = bundle.pipeline.transcriber.runtime
    assert runtime._key_pool is not None and runtime._key_pool.size == 3
    single = build_gemini_api_pipeline(GeminiApiPipelineFactoryConfig(gemini_api_key="k1"))
    assert single.pipeline.transcriber.runtime._key_pool is None


def test_env_pool_only_widens_backend_owned_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GEMINI_API_KEYS_JSON", '["env1", "env2", "env3"]')
    monkeypatch.setenv("GEMINI_API_KEY", "env1")
    # The env-backed session uses env1 → the other pool keys join it.
    assert debug_jobs._env_gemini_key_pool("env1") == ("env2", "env3")
    # A key typed into the browser is never widened with the server's keys.
    assert debug_jobs._env_gemini_key_pool("visitor-key") == ()
    monkeypatch.setenv("GEMINI_API_KEYS_JSON", "not json")
    assert debug_jobs._env_gemini_key_pool("env1") == ()


def test_pool_paces_each_key_and_waits_when_all_are_spent() -> None:
    now = [1000.0]
    slept: list[float] = []

    def sleep(seconds: float) -> None:
        slept.append(seconds)
        now[0] += seconds

    pool = GeminiKeyPool(["a", "b"], per_key_rpm=2, clock=lambda: now[0], sleep=sleep)
    # 2 keys x 2 rpm = 4 sends without waiting, round-robin.
    assert [pool.next_key() for _ in range(4)] == ["a", "b", "a", "b"]
    assert slept == []
    # The fifth waits until the oldest send (t=1000) leaves the minute window.
    now[0] = 1010.0
    assert pool.next_key() == "a"
    assert slept == [50.0]
    # Embedding calls have their own budget and are not blocked by generation.
    assert pool.next_key("embed") == "b"
    assert len(slept) == 1


def test_pool_pacing_can_be_disabled() -> None:
    pool = GeminiKeyPool(["a", "b"], per_key_rpm=0)
    assert [pool.next_key() for _ in range(5)] == ["a", "b", "a", "b", "a"]
