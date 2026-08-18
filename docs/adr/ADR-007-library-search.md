# ADR-007: Biblioteca y búsqueda textual local

- Estado: aceptado
- Fecha: 2026-08-13

## Decisión

La Biblioteca se consulta mediante un puerto de aplicación paginado. El adapter SQLite usa FTS5 con el tokenizador Unicode y eliminación de diacríticos para indexar documentos separados por sesión: metadata, transcripción y apuntes derivados. El renderer recibe únicamente tarjetas de sesión y conteos; nunca carga transcripciones completas para construir Home.

La migración `004-library.sql` añade `session_tags`, índices compuestos para tipo/materia y fecha, la tabla virtual `session_search` y el estado del backfill inicial. Los adapters actualizan su documento FTS cuando guardan una sesión, transcripción o apuntes. Al actualizar versiones existentes se realiza un único backfill después de montar todos los repositorios.

## Consecuencias

- La búsqueda textual permanece local y cubre título, materia/proyecto, tags, transcripción, resumen, temas, conceptos y tareas.
- La paginación limita cada respuesta a un máximo de 50 tarjetas.
- FTS5 evita recorridos y deserialización de todas las transcripciones al iniciar.
- Los tags se normalizan en el dominio y viven en una tabla relacional.
- No se implementan embeddings ni búsqueda semántica en esta fase.
