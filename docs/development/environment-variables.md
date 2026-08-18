# Environment Variables

| Variable                | Proceso     | Propósito                   |
| ----------------------- | ----------- | --------------------------- |
| `LECTA_AI_API_KEY`      | Main        | Credencial del proveedor IA |
| `LECTA_AI_BASE_URL`     | Main        | Endpoint compatible         |
| `LECTA_AI_MODEL`        | Main        | Modelo de generación        |
| `LECTA_EMBEDDING_MODEL` | Main/worker | Modelo local de embeddings  |
| `LECTA_PYTHON_PATH`     | Main        | Runtime de transcripción    |
| `LECTA_E2E`             | Main        | Seam exclusivo de tests     |
| `DOCS_URL`              | Docs build  | URL canónica futura         |
| `DOCS_BASE_URL`         | Docs build  | Base path de hosting        |

Usa `.env.example` como plantilla. `.env` y variantes están ignorados por Git; nunca documentes valores reales.
