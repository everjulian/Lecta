# Arquitectura de Lecta

## Objetivo

Lecta usa una arquitectura pragmática inspirada en Clean/Hexagonal Architecture. El objetivo es proteger las reglas del producto y permitir reemplazar Electron, SQLite, grabación, transcripción o IA sin reescribir el núcleo.

## Regla de dependencias

Las dependencias apuntan hacia el dominio:

```text
Renderer React -> Preload -> IPC/Main -> Application -> Domain
                                      -> Infrastructure (implementa puertos de Application)
Recording / Transcription / AI ------> Domain contracts when needed
Electron main -> Knowledge Worker -> embeddings / SQLite vector index
```

`domain` no depende de frameworks. `application` depende del dominio y define puertos. `infrastructure` implementa esos puertos. Electron ensambla las implementaciones en el composition root.

La grabación mantiene un límite adicional: `RecordingEngine` define el ciclo de captura; `ElectronRecordingAdapter` usa Web APIs en el renderer y envía únicamente chunks al proceso main. `FileRecordingStore` escribe esos chunks en disco. Los casos de uso de sesión no dependen de `MediaRecorder`.

## Capas

### Domain

Contiene `Session`, su máquina de estados y los modelos `Recording`, `Transcript`, `TranscriptSegment`, `StructuredNotes`, `Note` y `Task`. Sus errores esperables usan `DomainError`.

### Application

Orquesta los casos de uso sin conocer Electron ni almacenamiento. Define `SessionRepository`, `RecordingRepository`, `TranscriptRepository`, reloj y generador de IDs. Los fallos de orquestación usan `ApplicationError`.

### Infrastructure

Contiene adapters reemplazables. `SqliteSessionRepository` persiste sesiones y ejecuta migraciones versionadas; `InMemorySessionRepository` permanece disponible para pruebas unitarias. El filesystem llegará como un adapter separado. Los fallos técnicos deben envolverse en `InfrastructureError`.

### Desktop

El proceso main es el composition root. El preload expone una API pequeña mediante `contextBridge`. El renderer no recibe Node ni accede a almacenamiento o filesystem.

## Seguridad Electron

Cada `BrowserWindow` usa `contextIsolation: true`, `nodeIntegration: false` y sandbox. Los canales IPC son constantes compartidas y los inputs se validan al entrar al proceso main. Nunca se expone `ipcRenderer` completo.

Todos los handlers IPC responden con un resultado discriminado `success/data` o `success/error`. Main clasifica los fallos con códigos estables, registra únicamente metadata técnica saneada y nunca envía excepciones, stacks ni mensajes internos al renderer. El preload valida y desempaqueta el resultado. La política completa está en [ERRORS-AND-RECOVERY.md](ERRORS-AND-RECOVERY.md).

## Estado de sesión

Transiciones válidas: `IDLE -> RECORDING`, `RECORDING -> PAUSED | PROCESSING`, `PAUSED -> RECORDING | PROCESSING`, `PROCESSING -> COMPLETED | FAILED`. Los estados terminales no transicionan. El dominio rechaza cualquier otro cambio.

## Grabación

En Windows, Electron concede una fuente de pantalla con audio `loopback`; la pista de video se detiene inmediatamente. Web Audio mezcla sistema y micrófono y MediaRecorder produce WebM/Opus en chunks. El proceso main persiste cada chunk, metadata atómica y muestras aproximadas de CPU/RAM. No se ejecuta transcripción ni IA mientras el engine está activo.

## Transcripción offline

`TranscriptionQueue` persiste jobs en SQLite y permite un único job activo. Depende de `TranscriptionProvider`, no de faster-whisper. `FasterWhisperProvider` vive en el límite del worker e inicia un proceso Python separado; progreso y segmentos regresan como mensajes JSON. El renderer nunca ejecuta modelos ni accede al proceso.

Los transcripts y segmentos se persisten en SQLite. El audio se sirve al visor mediante el protocolo restringido `lecta-media`, permitiendo saltos por timestamp sin exponer filesystem al renderer.

## Notas con IA

El flujo es `Transcript -> TranscriptChunker -> GenerateStructuredNotes -> AIProvider -> StructuredNotesRepository`. Las notas son un artefacto derivado persistente: se procesan jerárquicamente, se validan antes de guardarse y regenerarlas nunca modifica audio ni transcripción. La credencial vive únicamente en Electron main; React recibe contratos tipados mediante IPC.

## Biblioteca

`SearchLibrary` depende de un puerto de consulta y recibe filtros y paginación validados por IPC. SQLite mantiene un índice FTS5 incremental con metadata, segmentos y apuntes. Home consulta tarjetas recientes y páginas pequeñas; la transcripción completa solo se carga al abrir una sesión.

## Conocimiento semántico

`KnowledgeChunker`, `EmbeddingProvider`, `VectorStore` y `KnowledgeRetriever` forman un límite independiente. Los chunks y vectores viven localmente y preservan sesión y rango temporal. `AskKnowledge` entrega al proveedor generativo únicamente evidencia recuperada y reconstruye las citas desde SQLite; una respuesta sin evidencia válida se convierte en el resultado vacío conservador.

La inferencia de embeddings, indexación, lectura de BLOBs, similitud y ranking se ejecutan en un child process Node dedicado. `KnowledgeWorkerClient` vive en el límite de main y se comunica mediante mensajes discriminados validados; main conserva únicamente coordinación, enriquecimiento de citas y síntesis. Cancelación, timeout, crash o mensajes inválidos terminan/reinician el worker sin cerrar Lecta. El worker conoce la base SQLite y el caché del modelo, pero nunca recibe rutas ni capacidades de grabación.

El build produce `dist/knowledge-worker/index.js`. La decisión y sus trade-offs están en [ADR-knowledge-worker.md](../adr/ADR-knowledge-worker.md); las mediciones 1k/10k/100k están en [KNOWLEDGE-WORKER.md](../performance/KNOWLEDGE-WORKER.md). El scan exacto permanece deliberadamente hasta que benchmarks posteriores justifiquen `sqlite-vec` u otra estrategia.

## Pruebas E2E

Playwright inicia el build real de Electron con un `userData` temporal por prueba. Cuando main recibe y valida `LECTA_E2E=1`, el composition root sustituye solo grabación, transcripción, IA y conocimiento por adapters deterministas; SQLite, filesystem, preload, IPC y casos de uso siguen siendo reales. El modo se rechaza en builds empaquetados y no puede activarse desde renderer. La suite se ejecuta offline, con un único proceso Electron a la vez, y verifica su terminación. Detalles en [E2E.md](../testing/E2E.md) y [ADR-e2e-test-seam.md](../adr/ADR-e2e-test-seam.md).

## Trade-offs

- Un monorepo con paquetes lógicos mejora límites y crecimiento, aunque añade configuración.
- Los modelos iniciales distintos de `Session` son deliberadamente pequeños: evitamos inventar reglas antes de conocerlas.
- Los repositorios de aplicación ejecutan SQLite en main detrás de puertos asíncronos; el índice semántico derivado es la excepción deliberada y abre su propia conexión WAL dentro del Knowledge Worker para aislar consultas largas.
- La validación IPC inicial es manual y pequeña. Si los contratos crecen, se evaluará una librería de esquemas mediante ADR.
- El child process de conocimiento consume más memoria base que un Worker Thread, pero aísla fallos nativos, permite cancelación dura y protege el event loop de Electron main.
