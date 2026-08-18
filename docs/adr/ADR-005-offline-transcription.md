# ADR-005: Transcripción offline en worker

- Estado: aceptado
- Fecha: 2026-08-07

## Decisión

Ejecutar toda inferencia en un proceso Python independiente iniciado por `FasterWhisperProvider`. `TranscriptionQueue` conoce únicamente la abstracción `TranscriptionProvider`, limita la concurrencia a un job y persiste cada cambio de estado en SQLite.

El worker usa `faster-whisper` con CPU e `int8`. `small` es el modelo inicial; `medium` queda disponible. Modo ligero usa aproximadamente la mitad de los hilos y `beam_size=1`; modo normal usa más hilos y `beam_size=5`.

Los modelos viven en el directorio de datos de Lecta. Se comprueba `model.bin` antes de descargar. La primera preparación requiere internet si el modelo no está instalado; la inferencia posterior es local y no envía audio.

## Proceso y recuperación

```text
Recording -> SQLite Queue -> Python worker -> SQLite Transcript/Segments
```

El worker comunica mensajes JSON por stdout. La cancelación termina solo ese proceso y conserva audio, sesión y transcripciones anteriores. Al iniciar, jobs en `QUEUED`, `PREPARING`, `TRANSCRIBING` o `SAVING` se marcan `FAILED` con opción de reinicio.

## Consecuencias

- Electron y el renderer permanecen responsivos.
- El adapter puede sustituirse por whisper.cpp u OpenAI sin modificar dominio ni cola.
- El runtime Python debe instalarse o empaquetarse con la distribución de Windows.
- La descarga inicial de `small` o `medium` puede tardar y ocupar varios cientos de MB.
- Solo se ejecuta una transcripción pesada simultáneamente.

## Referencias

- https://github.com/SYSTRAN/faster-whisper
- https://github.com/SYSTRAN/faster-whisper/blob/master/faster_whisper/transcribe.py
