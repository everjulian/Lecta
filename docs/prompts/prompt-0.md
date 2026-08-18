# Prompt 0 — Base arquitectónica

## Intención

Construir la base de Lecta con Electron, React, TypeScript, Node, SQLite, pnpm y Vitest, protegiendo el dominio de frameworks y adapters externos.

## Requisitos centrales

- Capas Domain, Application e Infrastructure.
- Main, preload y renderer separados.
- `contextIsolation: true` y `nodeIntegration: false`.
- Puertos para sesiones, grabaciones y transcripciones.
- Errores explícitos, Logger y TypeScript strict.
- README, arquitectura, ADR y reglas para agentes.

## Resultado vigente

La regla normativa está en [Architecture](../architecture/ARCHITECTURE.md) y las decisiones iniciales en [ADR-001](../adr/ADR-001-architecture.md), [ADR-002](../adr/ADR-002-local-first.md) y [ADR-003](../adr/ADR-003-electron.md).
