import argparse
import json
import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


def emit(payload):
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--recording", required=True)
    parser.add_argument("--model", choices=["small", "medium"], required=True)
    parser.add_argument("--mode", choices=["LIGHT", "NORMAL"], required=True)
    parser.add_argument("--models", required=True)
    args = parser.parse_args()

    emit({"type": "progress", "stage": "PREPARING", "percent": 2})
    try:
        from faster_whisper import WhisperModel
        from faster_whisper.utils import download_model
    except ImportError:
        emit({
            "type": "error",
            "message": "Falta faster-whisper. Ejecuta: python -m pip install -r workers/transcription-worker/requirements.txt",
        })
        return 2

    model_path = os.path.join(args.models, args.model)
    model_file = os.path.join(model_path, "model.bin")
    if not os.path.isfile(model_file):
        os.makedirs(model_path, exist_ok=True)
        emit({"type": "progress", "stage": "PREPARING", "percent": 5})
        download_model(args.model, output_dir=model_path)

    light = args.mode == "LIGHT"
    cpu_count = os.cpu_count() or 2
    threads = max(1, cpu_count // 2) if light else max(1, cpu_count - 1)
    model = WhisperModel(
        model_path,
        device="cpu",
        compute_type="int8",
        cpu_threads=threads,
        num_workers=1,
        local_files_only=True,
    )
    emit({"type": "progress", "stage": "TRANSCRIBING", "percent": 8})
    segments, info = model.transcribe(
        args.recording,
        beam_size=1 if light else 5,
        best_of=1 if light else 5,
        vad_filter=True,
        condition_on_previous_text=not light,
    )
    duration = max(float(info.duration), 0.001)
    for segment in segments:
        emit({
            "type": "segment",
            "startTime": float(segment.start),
            "endTime": float(segment.end),
            "text": segment.text.strip(),
        })
        progress = min(95, 8 + int((float(segment.end) / duration) * 87))
        emit({"type": "progress", "stage": "TRANSCRIBING", "percent": progress})
    emit({"type": "complete", "language": info.language})
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        emit({"type": "error", "message": str(error)})
        sys.exit(1)
