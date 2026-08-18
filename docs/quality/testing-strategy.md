# Testing Strategy

## Gates actuales

1. Prettier.
2. ESLint.
3. TypeScript strict.
4. Vitest unit/integration.
5. Build de aplicación y documentación.
6. Playwright Electron en job independiente.
7. axe sin violaciones serious/critical en flujos centrales.

Fixtures E2E sustituyen dispositivos, Whisper, IA y embeddings; SQLite, filesystem, preload, IPC y casos de uso permanecen reales. Consulta [E2E](../testing/E2E.md).
