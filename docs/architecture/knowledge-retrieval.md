# Knowledge Retrieval

Las preguntas siguen `Query → Retrieval → Evidencia → LLM → Respuesta con citas`. Cada fuente conserva sesión, fecha, timestamp y fragmento.

La recuperación semántica usa `EmbeddingProvider`, `VectorStore` y `KnowledgeRetriever`; el trabajo pesado ocurre en un child process. Cuando no hay evidencia suficiente, Lecta devuelve un resultado conservador en vez de inventar.

Consulta [ADR Semantic Knowledge](../adr/ADR-008-semantic-knowledge.md) y [Knowledge Worker Performance](../performance/KNOWLEDGE-WORKER.md).
