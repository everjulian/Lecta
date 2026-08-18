# System Overview

Lecta es un monorepo pnpm con una aplicación Electron, paquetes internos y workers aislados.

```text
React renderer
  ↓ contextBridge
Preload tipado
  ↓ IPC result
Electron main / composition root
  ↓ casos de uso y puertos
Domain + Application
  ↑ adapters
SQLite / filesystem / providers / workers
```

La fuente normativa de dependencias es [ARCHITECTURE.md](./ARCHITECTURE.md). Las decisiones con contexto y trade-offs viven en el [índice de ADR](../adr/index.md).
