# Database

SQLite implementa repositorios detrás de puertos de aplicación. React nunca abre la base directamente.

## Migraciones

| Versión | Alcance                           |
| ------- | --------------------------------- |
| 001     | Sesiones y estado                 |
| 002     | Jobs, transcripts y segmentos     |
| 003     | Apuntes estructurados             |
| 004     | Biblioteca, tags y FTS5           |
| 005     | Chunks y vectores de conocimiento |

Las migraciones están en `packages/infrastructure/src/sqlite/migrations`. La búsqueda textual usa FTS5 y la semántica mantiene un índice derivado reconstruible.

Consulta [ADR Library Search](../adr/ADR-007-library-search.md) y [Performance](../performance/PERFORMANCE.md).
