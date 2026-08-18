# Quick Start

## Requisitos

- Windows para captura loopback real.
- Node.js 22.
- pnpm indicado por `packageManager` en `package.json`.

## Preparación

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Para transcripción offline en Windows:

```powershell
pnpm setup:transcription
```

Para abrir esta documentación:

```bash
pnpm docs:dev
```

Antes de entregar un cambio ejecuta `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build`.

Consulta [Setup local](../development/setup-local.md) para configuración detallada.
