# ADR-008: búsqueda semántica local y respuestas con evidencia

- Estado: aceptado
- Fecha: 2026-08-13

## Contexto

La Biblioteca ya usa FTS5 para coincidencias textuales. Preguntas como «¿en qué clase explicó Clean Architecture?» requieren recuperar fragmentos por significado y producir una respuesta que siempre pueda auditarse contra audio y transcripción locales.

## Decisión

Se incorporan tres puertos independientes:

- `EmbeddingProvider`: convierte texto en vectores y declara modelo y dimensión.
- `VectorStore`: persiste chunks y vectores, y ejecuta similitud con filtros.
- `KnowledgeRetriever`: combina la pregunta con los candidatos y aplica un umbral mínimo.

El flujo será:

```text
Transcript segments -> KnowledgeChunker -> EmbeddingProvider -> VectorStore
Question -> EmbeddingProvider -> KnowledgeRetriever -> evidence -> AIProvider -> answer + citations
```

El adapter inicial de embeddings usa Transformers.js con un modelo multilingüe pequeño en ONNX. El modelo se descarga una vez al directorio de datos de Lecta y después puede ejecutarse sin red. La generación de la respuesta reutiliza `AIProvider`; solo recibe los fragmentos recuperados, nunca la biblioteca completa.

Los vectores se almacenan como `Float32` BLOB en SQLite junto con `sessionId`, `startTime`, `endTime`, texto, versión de modelo y dimensión. Inicialmente `SqliteVectorStore` usa ranking coseno exacto sobre candidatos locales. Esta elección evita una extensión nativa adicional y es suficiente para cientos de sesiones; el puerto permite migrar a `sqlite-vec` cuando el corpus o las métricas lo justifiquen.

## Evidencia y anti-alucinación

- El LLM debe seleccionar citas exclusivamente por IDs incluidos en el contexto recuperado.
- La respuesta se rechaza si contiene IDs desconocidos, carece de citas o tiene forma inválida.
- Cada cita se reconstruye desde metadata local, no desde texto generado por el LLM.
- Si no hay candidatos sobre el umbral, o la respuesta no puede validarse, se devuelve exactamente: «No encontré información suficiente en tus sesiones.»
- Cada fuente contiene sesión, fecha, inicio, fin y fragmento, y puede abrir el audio en el timestamp.

## Chunking e indexación

El chunker agrupa segmentos contiguos hasta un límite pequeño, sin cortar segmentos y preservando el primer `startTime` y último `endTime`. La huella del transcript y la versión del modelo hacen la indexación idempotente. Se indexa fuera del renderer y nunca durante una grabación activa.

## Trade-offs

- Transformers.js evita Python adicional y mantiene el texto local, pero añade un runtime ONNX y una descarga inicial del modelo.
- El ranking exacto es simple, determinista y fácil de probar, pero escala linealmente. Para decenas de miles de chunks se evaluará `sqlite-vec`, que es compacto y multiplataforma, aunque actualmente es pre-v1 y añade empaquetado de extensión nativa.
- La respuesta puede usar una API remota configurable; en ese caso solo salen la pregunta y los fragmentos recuperados. La recuperación y las fuentes permanecen locales.
- Umbrales conservadores reducen alucinaciones, pero pueden producir más respuestas vacías.

## Alternativas descartadas

- Embeddings remotos por defecto: menor privacidad y dependencia de red.
- Chroma/Qdrant/Weaviate: requieren un servicio adicional y son excesivos para una aplicación desktop local-first.
- Embeddings en renderer: bloquearían o aumentarían la superficie privilegiada de la UI.

## Referencias

- Transformers.js permite inferencia en Node, cache configurable y desactivar modelos remotos: https://github.com/huggingface/transformers.js/blob/main/packages/transformers/docs/source/tutorials/node.md
- ONNX Runtime ofrece binarios Node para Windows x64/arm64: https://onnxruntime.ai/docs/get-started/with-javascript/node.html
- sqlite-vec soporta vectores en SQLite y Windows, pero permanece pre-v1: https://github.com/asg017/sqlite-vec
