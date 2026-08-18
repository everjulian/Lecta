# Product States

## Session

```text
IDLE → RECORDING ⇄ PAUSED → PROCESSING → COMPLETED
                                      ↘ FAILED
```

No se permiten saltos fuera de esta máquina. `FAILED` representa fallo de procesamiento, no corrupción automática de grabación o transcripción.

## Transcription

`QUEUED → PREPARING → TRANSCRIBING → SAVING → COMPLETED`, con salidas recuperables `FAILED` y `CANCELLED`.

## Knowledge worker

Index y query tienen mensajes start, progress, complete, failed y cancel. Un crash no cierra Electron.
