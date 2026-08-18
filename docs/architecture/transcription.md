# Transcription

La cadena es `Recording → Queue → Transcription Worker → Transcript`. La cola persiste un máximo de un job pesado activo y recupera trabajos interrumpidos después de reiniciar.

`TranscriptionProvider` permite sustituir faster-whisper sin modificar dominio o aplicación. Los segmentos conservan sesión, inicio, fin y texto. El renderer recibe progreso y lee el audio mediante el protocolo restringido `lecta-media`.

Consulta [ADR Offline Transcription](../adr/ADR-005-offline-transcription.md) y [E2E](../testing/E2E.md).
