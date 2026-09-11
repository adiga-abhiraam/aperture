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
├── aperture-frontend/         # Browser UIs
│   ├── video_search_frontend/ # Main Vite + React search app
│   └── processing_debug_frontend/ # Next.js debug dashboard
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

Opens the debug UI at `http://127.0.0.1:3000` and the API at `http://127.0.0.1:8000`.

## Tech Stack

- **Backend**: Python, FastAPI, Qdrant (vector DB)
- **Processing**: FFmpeg, Whisper (ASR), X-CLIP (visual), CLAP (audio), BGE-M3 (text), Gemini / OpenAI (VLM captions)
- **Retrieval**: Named-vector search, reciprocal-rank fusion, Qwen-VL cross-encoder reranking
- **Frontend**: Vite, React, TypeScript, Tailwind CSS
- **Deploy**: Docker, Railway / Google Cloud Run
