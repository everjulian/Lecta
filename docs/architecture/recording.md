# Recording

`RecordingEngine` protege los casos de uso de detalles de `MediaRecorder`. En Windows, Electron concede audio loopback; el renderer mezcla sistema y micrófono con Web Audio y detiene inmediatamente cualquier pista de video auxiliar.

Los chunks WebM/Opus se envían a main y se escriben incrementalmente en:

```text
recordings/SESSION_ID/
├── chunks/
├── metadata.json
└── recording.webm
```

No se ejecuta Whisper, IA ni indexación pesada durante la captura. Consulta [ADR Windows Audio Capture](../adr/ADR-004-windows-audio-capture.md).
