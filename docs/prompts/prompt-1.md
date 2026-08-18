# Prompt 1 — Sesiones e interfaz principal

## Intención

Implementar sesiones persistentes y una interfaz desktop mínima antes de capturar audio real.

## Requisitos centrales

- Crear, listar y abrir sesiones.
- Estados IDLE, RECORDING, PAUSED, PROCESSING, COMPLETED y FAILED.
- Transiciones válidas protegidas por dominio.
- Flujo React → IPC → Application Service → Repository → SQLite.
- Contratos IPC explícitos y validación de inputs.

## Resultado vigente

La máquina de estados se describe en [Product States](../product/product-states.md) y la persistencia en [Database](../architecture/database.md).
