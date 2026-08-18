# Testing

La pirámide de Lecta combina:

- Dominio y casos de uso con Vitest.
- Repositorios SQLite y adapters mediante integración local.
- Protocolos de workers con procesos controlados.
- Flujos Electron reales con Playwright y providers deterministas.
- Accesibilidad central con axe y navegación por teclado.

Los tests no llaman OpenAI, no descargan modelos, no usan micrófono o loopback real y no acceden a datos de usuario.

Consulta [Testing Strategy](../quality/testing-strategy.md) y [Electron E2E](../testing/E2E.md).
