# Arquitectura de Lecta

## Objetivo

Lecta usa una arquitectura pragmática inspirada en Clean/Hexagonal Architecture. El objetivo es proteger las reglas del producto y permitir reemplazar Electron, SQLite, grabación, transcripción o IA sin reescribir el núcleo.

## Regla de dependencias

Las dependencias apuntan hacia el dominio:

```text
Renderer React -> Preload -> IPC/Main -> Application -> Domain
                                      -> Infrastructure (implementa puertos de Application)
Recording / Transcription / AI ------> Domain contracts when needed
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

## Trade-offs

- Un monorepo con paquetes lógicos mejora límites y crecimiento, aunque añade configuración.
- Los modelos iniciales distintos de `Session` son deliberadamente pequeños: evitamos inventar reglas antes de conocerlas.
- SQLite se ejecuta únicamente en el proceso main mediante el adapter de infraestructura. Su API síncrona queda encapsulada detrás de un puerto asíncrono, lo que simplifica la consistencia local a cambio de evitar consultas largas en el hilo principal.
- La validación IPC inicial es manual y pequeña. Si los contratos crecen, se evaluará una librería de esquemas mediante ADR.
