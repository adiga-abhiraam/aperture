"""Library behaviour the browser depends on: jobs survive a restart, can be
listed, expose a poster frame, and search can be scoped to one video."""

import json

from fastapi.testclient import TestClient

from processing_indexing.debug_jobs import JOB_STATE_FILE, Job, JobManager


def _job(root, job_id, status="created", config=None, created_at=1.0):
    directory = root / job_id
    directory.mkdir()
    path = directory / "clip.mp4"
    path.write_bytes(b"x")
    job = Job(job_id, directory, path, config or {}, {"filename": "clip.mp4", "duration": 12.0})
    job.status = status
    job.created_at = created_at
    return job


def test_created_job_is_persisted_and_restored_as_not_started(tmp_path):
    manager = JobManager(tmp_path)
    job = _job(tmp_path, "a", config={"title": "Beach cats"})
    manager.jobs[job.id] = job
    manager._persist(job)
    assert (tmp_path / "a" / JOB_STATE_FILE).is_file()

    fresh = JobManager(tmp_path)
    assert fresh.restore() == 1
    restored = fresh.get("a")
    assert restored.status == "created"
    assert restored.title == "Beach cats"
    assert restored.metadata["duration"] == 12.0
    assert restored.video_path.name == "clip.mp4"


def test_restore_reads_exports_of_a_finished_run(tmp_path):
    manager = JobManager(tmp_path)
    job = _job(tmp_path, "b", status="running")
    manager._persist(job)
    exports = tmp_path / "b" / "exports"
    exports.mkdir()
    (exports / "processing_report.json").write_text(
        json.dumps({"status": "complete", "successfully_indexed_windows": 2})
    )
    rows = [
        {"index": 0, "start": 0.0, "end": 10.0, "transcript": "hello", "caption": "a cat"},
        {"index": 1, "start": 5.0, "end": 15.0, "transcript": "world", "caption": ""},
    ]
    (exports / "window_debug.jsonl").write_text("\n".join(json.dumps(r) for r in rows))

    fresh = JobManager(tmp_path)
    fresh.restore()
    restored = fresh.get("b")
    assert restored.status == "complete"
    assert restored.progress == 1.0
    assert [w["index"] for w in restored.windows] == [0, 1]
    assert restored.summary()["indexed_windows"] == 2


def test_restore_marks_an_interrupted_run_as_failed(tmp_path):
    manager = JobManager(tmp_path)
    job = _job(tmp_path, "c", status="running")
    manager._persist(job)

    fresh = JobManager(tmp_path)
    fresh.restore()
    restored = fresh.get("c")
    assert restored.status == "failed"
    assert "interrupted" in restored.errors[0]["message"]


def test_restore_ignores_folders_without_a_video(tmp_path):
    (tmp_path / "junk").mkdir()
    (tmp_path / "junk" / "notes.txt").write_text("x")
    assert JobManager(tmp_path).restore() == 0


def test_list_is_newest_first_and_the_endpoint_returns_summaries(tmp_path, monkeypatch):
    from processing_indexing import debug_api

    manager = JobManager(tmp_path)
    for job_id, created in (("old", 1.0), ("new", 2.0)):
        job = _job(tmp_path, job_id, created_at=created)
        manager.jobs[job.id] = job
    monkeypatch.setattr(debug_api, "manager", manager)

    assert [j.id for j in manager.list()] == ["new", "old"]
    response = TestClient(debug_api.app).get("/api/processing/jobs")
    assert response.status_code == 200
    rows = response.json()["jobs"]
    assert [r["job_id"] for r in rows] == ["new", "old"]
    assert set(rows[0]) >= {"title", "status", "progress", "created_at", "metadata"}
    # Listing rows are deliberately light: no activity log or model status.
    assert "activity" not in rows[0]


def test_thumbnail_is_extracted_once_and_cached(tmp_path, monkeypatch):
    from processing_indexing import debug_api

    manager = JobManager(tmp_path)
    job = _job(tmp_path, "t")
    manager.jobs[job.id] = job
    monkeypatch.setattr(debug_api, "manager", manager)

    calls = []

    def fake_extract(video_path, output, duration, ffmpeg="ffmpeg"):
        calls.append(video_path)
        output.write_bytes(b"\xff\xd8\xff\xd9")

    monkeypatch.setattr(debug_api, "extract_poster_frame", fake_extract)
    client = TestClient(debug_api.app)
    first = client.get("/api/processing/jobs/t/thumbnail")
    second = client.get("/api/processing/jobs/t/thumbnail")
    assert first.status_code == second.status_code == 200
    assert first.headers["content-type"] == "image/jpeg"
    assert len(calls) == 1


def test_thumbnail_failure_is_a_404_not_a_500(tmp_path, monkeypatch):
    from processing_indexing import debug_api

    manager = JobManager(tmp_path)
    job = _job(tmp_path, "u")
    manager.jobs[job.id] = job
    monkeypatch.setattr(debug_api, "manager", manager)

    def boom(*_args, **_kwargs):
        raise RuntimeError("no ffmpeg")

    monkeypatch.setattr(debug_api, "extract_poster_frame", boom)
    assert TestClient(debug_api.app).get("/api/processing/jobs/u/thumbnail").status_code == 404


def test_video_filter_limits_qdrant_search_to_one_video():
    from query_retrieval.qdrant_client import video_filter

    assert video_filter(None) is None
    condition = video_filter("abc").must[0]
    assert condition.key == "video_id"
    assert condition.match.value == "abc"


def test_search_passes_video_id_to_every_modality(monkeypatch):
    from query_retrieval import api, config, encoders

    monkeypatch.setattr(encoders, "warmup", lambda: None)
    monkeypatch.setattr(api, "_encoders_ready", True)
    monkeypatch.setattr(config, "ENABLE_QUERY_DECOMPOSITION", False)
    monkeypatch.setattr(config, "ENABLE_VERIFICATION", False)
    monkeypatch.setattr(config, "QUERY_LOW_MEMORY_MODE", False)
    monkeypatch.setattr(encoders, "encode_query", lambda q: {m: [0.0] for m in config.VECTOR_NAMES})

    seen: dict[str, str | None] = {}

    def make(modality):
        def fn(vector, top_k, video_id=None):
            seen[modality] = video_id
            return []

        return fn

    monkeypatch.setattr(api, "_SEARCH_FNS", {m: make(m) for m in config.VECTOR_NAMES})
    response = TestClient(api.app).post("/search", json={"query": "cat", "video_id": "vid-1"})
    assert response.status_code == 200
    assert response.json()["results"] == []
    assert seen == {m: "vid-1" for m in config.VECTOR_NAMES}


def test_start_created_job_queues_and_launches_run(tmp_path, monkeypatch):
    manager = JobManager(tmp_path)
    job = _job(tmp_path, "j1", status="created")
    manager.jobs[job.id] = job

    run_called = []
    monkeypatch.setattr(manager, "_run", lambda j: run_called.append(j.id))

    started = manager.start("j1")
    assert started.status == "queued"
    assert started.stage == "queued"
    assert manager._active == "j1"


def test_start_failed_or_cancelled_job_resets_state_and_retries(tmp_path, monkeypatch):
    manager = JobManager(tmp_path)
    job = _job(tmp_path, "j2", status="failed")
    job.cancel_requested = True
    job.windows = [{"index": 0, "caption": "old caption"}]
    job.errors = [{"message": "previous error"}]
    job.activity = [{"area": "job", "message": "old log"}]
    job.activity_sequence = 1
    job.events = [{"event": "failed"}]

    exports = tmp_path / "j2" / "exports"
    exports.mkdir()
    (exports / "window_debug.jsonl").write_text("old data")

    manager.jobs[job.id] = job
    monkeypatch.setattr(manager, "_run", lambda j: None)

    retried = manager.start("j2")
    assert retried.status == "queued"
    assert retried.stage == "queued"
    assert retried.cancel_requested is False
    assert retried.windows == []
    assert retried.errors == []
    assert not exports.exists()


def test_start_already_running_or_queued_job_raises_error(tmp_path):
    import pytest

    manager = JobManager(tmp_path)
    job = _job(tmp_path, "j3", status="running")
    manager.jobs[job.id] = job

    with pytest.raises(RuntimeError, match="Job is already running or queued"):
        manager.start("j3")


def test_start_when_another_job_active_raises_error(tmp_path):
    import pytest

    manager = JobManager(tmp_path)
    j1 = _job(tmp_path, "j1", status="created")
    j2 = _job(tmp_path, "j2", status="created")
    manager.jobs[j1.id] = j1
    manager.jobs[j2.id] = j2
    manager._active = "j1"

    with pytest.raises(RuntimeError, match="Another processing job is active"):
        manager.start("j2")


def test_start_endpoint_allows_retrying_failed_job(tmp_path, monkeypatch):
    from processing_indexing import debug_api

    manager = JobManager(tmp_path)
    job = _job(tmp_path, "j_failed", status="failed")
    manager.jobs[job.id] = job
    monkeypatch.setattr(debug_api, "manager", manager)
    monkeypatch.setattr(manager, "_run", lambda j: None)

    client = TestClient(debug_api.app)
    response = client.post("/api/processing/jobs/j_failed/start")
    assert response.status_code == 200
    assert response.json()["status"] == "queued"



def test_delete_removes_folder_and_clears_index_points(tmp_path, monkeypatch):
    manager = JobManager(tmp_path)
    job = _job(tmp_path, "d", status="complete", config={"index_qdrant": True})
    job.metadata["video_id"] = "hash-d"
    job.windows = [{"index": 0}]
    manager.jobs[job.id] = job

    cleared = []
    monkeypatch.setattr(manager, "_delete_index_points", lambda j, vid: cleared.append(vid) or True)

    result = manager.delete("d")
    assert result == {"deleted": "d", "index_cleared": True}
    assert cleared == ["hash-d"]
    assert not (tmp_path / "d").exists()
    assert "d" not in manager.jobs


def test_delete_survives_a_qdrant_outage(tmp_path, monkeypatch):
    manager = JobManager(tmp_path)
    job = _job(tmp_path, "e", status="complete", config={"index_qdrant": True})
    job.metadata["video_id"] = "hash-e"
    job.windows = [{"index": 0}]
    manager.jobs[job.id] = job

    def boom(*_):
        raise ConnectionError("qdrant down")

    monkeypatch.setattr(manager, "_delete_index_points", boom)
    assert manager.delete("e")["index_cleared"] is False
    assert not (tmp_path / "e").exists()


def test_delete_refuses_a_running_job_and_the_endpoint_says_409(tmp_path, monkeypatch):
    import pytest
    from processing_indexing import debug_api

    manager = JobManager(tmp_path)
    job = _job(tmp_path, "r", status="running")
    manager.jobs[job.id] = job
    monkeypatch.setattr(debug_api, "manager", manager)

    with pytest.raises(RuntimeError):
        manager.delete("r")
    assert (tmp_path / "r").exists()

    client = TestClient(debug_api.app)
    assert client.delete("/api/processing/jobs/r").status_code == 409
    assert client.delete("/api/processing/jobs/missing").status_code == 404

    job.status = "failed"
    monkeypatch.setattr(manager, "_delete_index_points", lambda *_: True)
    assert client.delete("/api/processing/jobs/r").status_code == 200
    assert client.get("/api/processing/jobs/r").status_code == 404


def test_api_job_configuration_keeps_the_display_title():
    from processing_indexing import debug_api
    from processing_indexing.runtime_profiles import get_profile

    class Session:
        profile = get_profile("api-gemini-free-v1")
        configuration = {"window_seconds": 20.0, "stride_seconds": 10.0}

    normalized = debug_api._normalize_api_job_configuration(
        {"profile_id": "api-gemini-free-v1", "runtime_session_id": "s1", "title": "  Beach cats  ", "index_qdrant": True},
        Session(),
    )
    assert normalized["title"] == "Beach cats"
    assert normalized["runtime_session_id"] == "s1"


def test_summary_reports_the_profile_used(tmp_path):
    local = _job(tmp_path, "l")
    api = _job(tmp_path, "a", config={"profile_id": "api-gemini-free-v1"})
    assert local.summary()["profile_id"] == "self-hosted-v1"
    assert api.summary()["profile_id"] == "api-gemini-free-v1"
