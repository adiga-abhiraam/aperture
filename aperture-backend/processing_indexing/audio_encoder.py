from pathlib import Path
from typing import Protocol

from .model_cache import model_load_kwargs
from .models import VideoWindow

SILENT_AUDIO_VECTOR = [0.0] * 512


class AudioEncoder(Protocol):
    def encode(
        self, video_path: Path, window: VideoWindow, has_audio: bool
    ) -> list[float]: ...


class ClapAudioEncoder:
    """Silent/missing audio uses a deterministic zero sentinel while payload has_audio is false."""

    def __init__(self, model_name="laion/clap-htsat-unfused", device="cpu"):
        self.model_name, self.device, self._model, self._processor = (
            model_name,
            device,
            None,
            None,
        )
        self._audio_cache = {}

    def _get_audio(self, video_path):
        key = str(video_path)
        if key not in self._audio_cache:
            import librosa
            audio, _ = librosa.load(key, sr=48000, mono=True)
            self._audio_cache[key] = audio
        return self._audio_cache[key]

    def encode(self, video_path, window, has_audio):
        if not has_audio:
            return SILENT_AUDIO_VECTOR.copy()
        import numpy as np
        import torch

        try:
            full_audio = self._get_audio(video_path)
            start_sample = int(window.start * 48000)
            end_sample = int(window.end * 48000)
            audio = full_audio[start_sample:end_sample]
        except Exception:
            return SILENT_AUDIO_VECTOR.copy()

        if audio.size == 0 or float(np.max(np.abs(audio))) < 1e-8:
            return SILENT_AUDIO_VECTOR.copy()
        if self._model is None:
            from transformers import AutoProcessor, ClapAudioModelWithProjection

            load_kwargs = model_load_kwargs(self.model_name)
            self._processor = AutoProcessor.from_pretrained(
                self.model_name, **load_kwargs
            )
            self._model = (
                ClapAudioModelWithProjection.from_pretrained(
                    # The cached CLAP revision ships ``pytorch_model.bin``.
                    # Leaving the format automatic lets Transformers use that
                    # valid local file instead of reaching the Hub for a
                    # Safetensors revision that is not cached.
                    self.model_name, **load_kwargs
                )
                .to(self.device)
                .eval()
            )
        try:
            processed = self._processor(audios=audio, sampling_rate=48000, return_tensors="pt")
        except TypeError:
            processed = self._processor(audio=audio, sampling_rate=48000, return_tensors="pt")

        inputs = {
            k: v.to(self.device)
            for k, v in processed.items()
        }
        with torch.inference_mode():
            vector = (
                torch.nn.functional.normalize(
                    self._model(**inputs).audio_embeds[0], dim=0
                )
                .cpu()
                .float()
                .tolist()
            )
        if len(vector) != 512 or not np.isfinite(vector).all():
            raise ValueError("invalid CLAP vector")
        return vector
