# Security

## Límites

- `contextIsolation: true`, `nodeIntegration: false` y sandbox.
- API mínima mediante `contextBridge`.
- Inputs validados en IPC.
- Rutas y secretos permanecen en main.
- Protocolo de audio limitado a grabaciones conocidas.
- Logs sin claves, transcripts, audio, prompts ni stacks.

Las vulnerabilidades deben reportarse según `SECURITY.md`. Para errores seguros consulta [Error and recovery model](./ERRORS-AND-RECOVERY.md).
