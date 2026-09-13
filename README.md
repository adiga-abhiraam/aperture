# Aperture — Multimodal Video Search

Search any video archive the way you remember it — by text, voice, images, or reference clips — and ask questions about a video with every answer tied to a timestamp.

## Project Structure

```
aperture/
├── aperture-backend/              # Python FastAPI backend
│   ├── processing_indexing/       # Upload, processing, embedding, Qdrant indexing, video chat
│   ├── query_retrieval/           # Multimodal search, fusion, reranking, verification
│   ├── test_assets/               # Test media and fixtures
│   └── requirements*.txt
│
├── aperture-frontend/
│   └── video_search_frontend/     # Vite + React app (the only UI)
│       └── src/pages/             # Landing (live search), Dashboard, Watch, Preprocess, …
│
├── processing_jobs/               # Local library: one folder per uploaded video (git-ignored)
├── Dockerfile                     # Single-container deploy (Railway / Cloud Run)
├── docker-compose.yml             # Local Qdrant
├── start-local.ps1                # One-command local dev launcher
└── .env.example                   # Required environment variables
```

## Quick Start

```powershell
copy .env.example .env            # then fill in GEMINI_API_KEY
.\start-local.ps1 -Setup          # first time: venv, pip, npm ci
.\start-local.ps1                 # later runs (add -Restart to replace a stuck API)
```

Opens the UI at `http://127.0.0.1:3000` and the API at `http://127.0.0.1:8000` (`/docs` for the OpenAPI UI). Qdrant runs in Docker on 6333.

## Pages

| Route | What it does |
|---|---|
| `/` | Public demo: live search over a sample or uploaded clip |
| `/dashboard` | **Library** of every uploaded video: status, upload / processing time, Process · Stop · Delete, filters |
| `/videos/<job_id>` | **Watch page**: player, transcript, key moments, timing breakdown, and *Ask this video* chat |
| `/preprocess` | Single-call quick index (stateless demo) |

### Dashboard → Watch → Chat

1. **Add videos** picks an engine per upload:
   - **Cloud API (Gemini)** — transcription, embeddings and captions via Gemini using the key in `.env`. Fastest on a laptop.
   - **This computer** — Whisper + X-CLIP + CLAP + BGE-M3 on the local CPU. Nothing leaves the machine.
   
   Both engines use 10 s windows. *Fast* tiles the video (18 windows for a 3-minute clip); *Precise* steps every 5 s (twice the calls, finer matches). On the Cloud API every window gets its own scene description.
2. Cards show live stage + progress while processing, and afterwards the measured **upload time**, **processing time** and indexed window count. **Stop** cancels between model calls; **Delete** removes the file, artifacts, chat history and the video's vectors.
3. Clicking a card opens the watch page. The chat answers from that video's transcript, per-window scene descriptions and detected **sound events** (sirens, horns, alarms, crashes… each with the exact second it starts); every `[mm:ss]` in an answer seeks the player and each citation shows the cited frame. If those notes can't answer, the model watches the footage itself — the reply is tagged *Watched the footage* — and only says *not found in this video* when neither can answer. The footage is uploaded to Gemini once per video (pre-warmed when the page opens) so follow-up questions take a few seconds.
4. **Find this** — attach a photo (or paste a screenshot) in the chat: the model first describes the subject in detail (*Looking for: red motorcycle — bright red tank, rectangular headlight…*), then finds that exact item in the footage even when look-alikes are present.
5. **Results** (tab next to the chat) collects every moment the answers cited: thumbnail, timestamp, evidence, and **Clip ↓** (MP4 around the moment) / **Frame ↓** (JPEG) downloads, plus **Export CSV** for the whole list.

## Where data lives (nothing is lost on restart)

| Data | Location |
|---|---|
| Upload, `job.json`, exports (`window_debug.jsonl`, transcript, report) | `processing_jobs/<job_id>/` |
| Chat history | `processing_jobs/<job_id>/chat.json` |
| Vectors | Qdrant (`qdrant_data` Docker volume, or Qdrant Cloud via `QDRANT_URL`/`QDRANT_API_KEY`) |

Jobs are reloaded from disk when the API starts. A job that was mid-run during a restart is marked failed and can be re-run with **Retry**. Cloud-API jobs re-attach to a backend-owned runtime session built from `.env`, so they can be reprocessed and chatted with after a restart.

## Processing speed

The Cloud-API pipeline runs hosted calls concurrently and reports per-stage timings (shown under *Details* on the watch page). Tune in `.env`:

```
API_EMBED_CONCURRENCY=12         # windows embedded at once (each window's 3 modality calls also run together)
API_CAPTION_CONCURRENCY=8
API_TRANSCRIPTION_CONCURRENCY=3
API_CAPTION_ALL_WINDOWS=1        # 0 = caption only scene changes (fewer calls, thinner chat context)
API_CLIP_MAX_HEIGHT=360          # clips are downscaled before upload; 0 = keep source size
API_CLIP_FPS=6
```

Clips and audio chunks under 12 MB are sent inline with the request rather than through the Files API (no upload → wait → delete round trip). Reference: a 7.5-minute clip (46 windows, all captioned, sound events on) processes in about 55 s with the 14-key pool below; with a single free key the caption stage is quota-bound at ~12 windows per minute, so budget ~1 minute of processing per minute of video.

Two things the pipeline does to stay clear of Gemini's free-tier limiter, since they are easy to undo by accident: every request starts with a unique `Request <id>.` line, and the caption/transcription/sound prompts put their independent instructions in a random order. Gemini fingerprints prompt text and bounces near-identical requests with a generic 429 (no quota id) once too many arrive per minute — a job sends hundreds from one template, and before this every second caption was silently retried after a 2–20 s sleep.

Rate-limit (429) responses are retried with backoff up to ~50 s total. To avoid hitting them at all, add several free keys to `GEMINI_API_KEYS_JSON` (JSON array): jobs rotate through the pool and **pace each key** at `GEMINI_PER_KEY_RPM` requests per minute (default 12, below the free-tier limit; `0` disables pacing). 14 keys process a 24-minute video in about 5 minutes with no dropped captions.

```
GEMINI_API_KEYS_JSON=["key1","key2",...]
GEMINI_PER_KEY_RPM=12
CHAT_VIDEO_FALLBACK_MAX_MB=200      # largest video the chat will send to the model whole
CHAT_VIDEO_FALLBACK_MAX_MINUTES=40
```

## API surface used by the UI

| UI action | API |
|---|---|
| Library grid | `GET /api/processing/jobs` |
| Upload | `POST /api/processing/jobs` (multipart `video` + `configuration` JSON; header `X-Upload-Started-Ms` records upload time) |
| Process / Stop / Delete | `POST …/{id}/start`, `POST …/{id}/cancel`, `DELETE …/{id}` |
| Watch page | `GET …/{id}`, `GET …/{id}/video` (range requests), `GET …/{id}/windows`, `GET …/{id}/thumbnail` |
| Chat | `GET/POST/DELETE …/{id}/chat`; `POST …/{id}/chat/ask` (multipart `question` + optional `image`); `POST …/{id}/chat/warm` (pre-upload footage); `GET …/{id}/chat/images/{name}` |
| Results | `GET …/{id}/frame/{seconds}` (`?download=1` for a file), `GET …/{id}/clip?start=&end=` (MP4, ≤120 s) |
| Cloud session (keys stay server-side) | `GET /api/runtime/env-session` |

## Tech Stack

- **Backend**: Python 3.11/3.12, FastAPI, Qdrant
- **Processing**: FFmpeg; Gemini (Flash-Lite + Embedding 2) or local Whisper / X-CLIP / CLAP / BGE-M3; optional Qwen-VL captioning
- **Retrieval**: Named-vector search, reciprocal-rank fusion, optional cross-encoder reranking
- **Frontend**: Vite, React 19, TypeScript, Tailwind CSS
- **Deploy**: Docker (API serves the built SPA when `SERVE_FRONTEND=1`), Railway / Google Cloud Run
