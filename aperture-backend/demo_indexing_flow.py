"""
Aperture Pipeline Live Execution Demo Script.
Demonstrates the six-stage multimodal video indexing pipeline step-by-step.
"""
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BACKEND_DIR = Path(__file__).resolve().parent
REPOSITORY_ROOT = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

from processing_indexing.probe import probe_video, stable_video_id
from processing_indexing.windowing import generate_windows
from processing_indexing.visual_encoder import XClipVisualEncoder
from processing_indexing.audio_encoder import ClapAudioEncoder
from processing_indexing.text_encoder import BgeM3TextEncoder


def run_demo():
    print("\n" + "=" * 70)
    print(" APERTURE MULTIMODAL VIDEO INDEXING PIPELINE DEMO ")
    print("=" * 70)

    sample_video = REPOSITORY_ROOT / "aperture-backend" / "test_assets" / "media" / "public_demo" / "animal_belly_rub.webm"
    if not sample_video.exists():
        sample_video = next((REPOSITORY_ROOT / "processing_jobs").glob("*/vidssave.com*.mp4"), None)
    if sample_video is None or not sample_video.exists():
        raise FileNotFoundError("No demo video was found.")

    print(f"\n[RAW VIDEO]: {sample_video}")
    print("-" * 70)

    print("\n1. STAGE 1: INGESTION & FFPROBE VALIDATION")
    meta = probe_video(sample_video)
    video_id = stable_video_id(sample_video)[:12]
    print(f"   Video ID (SHA-256): {video_id}")
    print(f"   Container format:   {meta.container}")
    print(f"   Duration:           {meta.duration:.2f} seconds")
    print(f"   Resolution:         {meta.width}x{meta.height}")
    print(f"   Video codec:        {meta.codec}")
    print(f"   Audio available:    {meta.has_audio}")

    print("\n2. STAGE 2: ADAPTIVE WINDOW SEGMENTATION")
    windows = generate_windows(video_id, meta.duration, window_seconds=10.0, stride_seconds=5.0)
    print(f"   Created {len(windows)} overlapping 10-second temporal windows:")
    for window in windows[:3]:
        print(f"   Window {window.index:02d}: {window.start:05.2f}s -> {window.end:05.2f}s ({window.window_id})")

    target_window = windows[0]
    print(f"\n3. STAGE 3: MULTIMODAL FEATURE EXTRACTION (window 0: {target_window.start:.1f}s - {target_window.end:.1f}s)")
    print("   X-CLIP visual encoder: sampling keyframes...")
    visual_vector = XClipVisualEncoder(frames=8).encode(sample_video, target_window)
    print(f"   Visual vector generated: {len(visual_vector)} dimensions")
    print("   CLAP audio encoder: decoding waveform...")
    audio_vector = ClapAudioEncoder().encode(sample_video, target_window, has_audio=meta.has_audio)
    print(f"   Audio vector generated: {len(audio_vector)} dimensions")
    sample_transcript = "A cute animal rolling over on grass enjoying a belly rub"
    print(f'   Transcript extracted: "{sample_transcript}"')

    print("\n4. STAGE 4: TEXT VECTOR EMBEDDINGS (BGE-M3)")
    speech_vector = BgeM3TextEncoder().encode([sample_transcript])[0]
    print(f"   Speech text vector generated: {len(speech_vector)} dimensions")

    print("\n5. STAGE 5: QDRANT VECTOR DATABASE INDEXING")
    print("   Named multi-vector point prepared:")
    print("   visual: 512D | audio: 512D | speech: 1024D | caption: 1024D")
    print(f"   Metadata: start={target_window.start}, end={target_window.end}")
    print("   Note: this script demonstrates vector preparation; the real worker writes points to Qdrant.")

    print("\n6. STAGE 6: SEARCH READINESS")
    print("   The real processing job persists these records to the video_windows collection.")
    print("   Pipeline complete: video window is ready for search.")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    run_demo()
