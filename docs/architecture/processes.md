# Processes

| Proceso              | Responsabilidad                            | No debe hacer                 |
| -------------------- | ------------------------------------------ | ----------------------------- |
| Renderer             | UX, estado visual, captura Web Media       | SQLite, filesystem, secretos  |
| Preload              | API mínima y tipada                        | Exponer `ipcRenderer` o Node  |
| Electron main        | Lifecycle, IPC, composición y persistencia | Inferencia o ranking pesado   |
| Knowledge Worker     | Embeddings, indexación y ranking           | Modificar grabaciones         |
| Transcription Worker | Ejecutar el proveedor de transcripción     | Bloquear Electron o grabación |

Consulta [Workers](./workers.md) y [ADR Knowledge Worker](../adr/ADR-knowledge-worker.md).
