# Aperture — Multimodal Video Search

Search any video archive the way you remember it — by text, voice, images, or reference clips.

## Project Structure

```
aperture/
├── aperture-backend/          # Python FastAPI backend
│   ├── processing_indexing/   # Video upload, processing, embedding, Qdrant indexing
│   ├── query_retrieval/       # Multimodal search, fusion, reranking, verification
│   ├── test_assets/           # Test media and fixtures
│   ├── requirements*.txt      # Python dependencies
│   └── conftest.py / pytest.ini
│
├── aperture-frontend/         # Next.js app (dashboard, watch page, video-scoped chat)
│   ├── app/                   # Routes: /login, /dashboard, /videos/[id]
│   ├── features/              # Feature slices: dashboard, video-review, ai-chat, ...
│   ├── components/            # Shared shell (AppShell, Navbar, Sidebar) and UI primitives
│   ├── services/              # API client + adapters (mock kept behind NEXT_PUBLIC_USE_MOCK=1)
│   ├── video_search_frontend/ # Legacy Vite app (assets only; not run locally)
│   └── processing_debug_frontend/ # Legacy debug dashboard (not run locally)
│
├── Dockerfile                 # Single-container deploy (Railway / Cloud Run)
├── docker-compose.yml         # Local Qdrant
├── start-local.ps1            # One-command local dev launcher
└── .env.example               # Required environment variables
```

## Quick Start

```powershell
# First time setup
.\start-local.ps1 -Setup

# Subsequent runs
.\start-local.ps1
```

Opens the app at `http://127.0.0.1:3000` and the API at `http://127.0.0.1:8000`.

Frontend only: `cd aperture-frontend && npm run dev` (Turbopack; first page ~10 s, later pages under 1 s).

## How the frontend talks to the backend

| UI action | API |
|---|---|
| Library grid | `GET /api/processing/jobs` (jobs are restored from `processing_jobs/` on startup) |
| Card poster | `GET /api/processing/jobs/{id}/thumbnail` (ffmpeg frame, cached) |
| Upload | `POST /api/processing/jobs` (multipart `video` + `configuration` JSON with `title`, `vlm_mode`) |
| Process | `POST /api/processing/jobs/{id}/start`, then polled via `GET /api/processing/jobs/{id}` |
| Player | `GET /api/processing/jobs/{id}/video` (range requests) |
| Transcript / moments | `GET /api/processing/jobs/{id}/windows` |
| Chat | `POST /api/query/search` with `video_id` — answers are composed only from matching windows |

Chat needs a processed video and a running Qdrant (`docker compose up -d qdrant`).

## Tech Stack

- **Backend**: Python, FastAPI, Qdrant (vector DB)
- **Processing**: FFmpeg, Whisper (ASR), X-CLIP (visual), CLAP (audio), BGE-M3 (text), Gemini / OpenAI (VLM captions)
- **Retrieval**: Named-vector search, reciprocal-rank fusion, Qwen-VL cross-encoder reranking
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS (Material 3 tokens, light/dark)
- **Deploy**: Docker, Railway / Google Cloud Run
