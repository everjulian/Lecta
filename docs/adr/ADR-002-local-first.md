# ADR-002: Local-first

- Estado: aceptado
- Fecha: 2026-08-07

## Decisión

Los datos primarios viven localmente en SQLite mediante un adapter de infraestructura y migraciones versionadas. El audio vivirá en filesystem en una fase posterior. Las capacidades externas serán opcionales y explícitas.

## Consecuencias

La aplicación puede trabajar sin conexión y el usuario conserva control de sus datos. Debemos seguir diseñando backups, privacidad y recuperación ante corrupción. React nunca conoce la base de datos.
