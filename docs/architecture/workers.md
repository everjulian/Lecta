# Workers

Lecta separa dos cargas pesadas:

- `workers/transcription-worker`: proceso Python controlado mediante `TranscriptionProvider`.
- `workers/knowledge-worker`: child process Node con protocolo tipado para indexar y consultar.

Main conserva lifecycle, coordinación y persistencia. Cancelación, timeout o crash del worker producen errores recuperables y no cierran Lecta.

Consulta [ADR Knowledge Worker](../adr/ADR-knowledge-worker.md) y [ADR E2E seam](../adr/ADR-e2e-test-seam.md).
