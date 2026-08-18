# Auditoría integral de calidad de Lecta

- Fecha: 2026-08-13
- Alcance: código fuente, configuración, migraciones, tests y documentación presentes en el repositorio
- Baseline: lint y typecheck correctos; 39 tests correctos; build correcto; `format:check` falló en 2 archivos
- Método: inspección estática, ejecución de validaciones, revisión de contratos y rutas de fallo, análisis de queries/índices y conteo de complejidad visual

## Executive Summary

Lecta conserva una dirección de dependencias saludable y protege correctamente el dominio de Electron, React, SQLite y proveedores. La grabación incremental, la cola de transcripción y los artefactos derivados son buenas decisiones. No se identificó una vulnerabilidad crítica explotable con la superficie actual.

Todavía no debe considerarse release-ready por las tareas medias y bajas detalladas abajo. Desde la auditoría inicial, H1 fue corregido: la búsqueda vectorial ejecuta inferencia y ranking lineal en un child process medido, sin bloquear Electron main. H4 también fue resuelto con Playwright Electron, diez escenarios offline y auditoría axe en tres superficies. La UI funciona, pero `App`, `HomeView` y una hoja CSS extensa concentran demasiadas responsabilidades.

| Área            | Puntuación /10 | Evidencia resumida                                                                 |
| --------------- | -------------: | ---------------------------------------------------------------------------------- |
| Architecture    |              8 | Capas claras; worker semántico aislado y reiniciable                               |
| Code Quality    |              7 | strict, sin `any`, `@ts-ignore` ni logging disperso; componentes/archivos grandes  |
| Testing         |              8 | 48 unit/integration y 14 E2E Electron; falta regresión visual dedicada             |
| Security        |              7 | aislamiento, sandbox, CSP e IPC explícito; permisos/navegación e inputs mejorables |
| Performance     |              7 | paginación/FTS/chunks; vector scan aislado y benchmark reproducible                |
| Accessibility   |              8 | gate axe, teclado, foco, live regions, reduced motion y reflow 200 % automatizados |
| Design System   |              3 | lenguaje visual coherente, pero sin tokens/componentes base y ~80 colores hex      |
| Maintainability |              6 | paquetes pequeños en backend; `HomeView`, `App` y CSS concentran cambios           |
| Scalability     |              6 | 1.000 sesiones razonables para biblioteca; 10.000 penalizan vectores y filesystem  |

## System Map

```text
BrowserWindow (sandbox, contextIsolation)
  -> React renderer
     -> preload/contextBridge (LectaApi)
        -> IPC handlers en Electron main
           -> casos de uso / servicios de aplicación
              -> puertos
                 <- SQLite repositories
                 <- filesystem recording store
                 <- transcription queue -> Python faster-whisper child process
                 <- AIProvider -> API compatible
           -> Knowledge Worker child process
                 <- EmbeddingProvider -> Transformers.js/ONNX
                 <- SQLite vector index + ranking
```

- `apps/desktop/main`: lifecycle, permisos, protocolo de audio, IPC y composition root.
- `apps/desktop/preload`: API mínima por capacidad; no expone `ipcRenderer`.
- `apps/desktop/renderer`: React y RecordingEngine basado en Web APIs; no importa filesystem ni SQLite.
- `packages/domain`: `Session` y modelos puros.
- `packages/application`: casos de uso y puertos de sesión/biblioteca.
- `packages/infrastructure`: SQLite, metadata de grabación y preferencias.
- `packages/recording`: máquina del engine, mezcla y escritura secuencial de chunks.
- `packages/transcription`: cola de concurrencia 1; provider sustituible.
- `workers/transcription-worker`: child process Python/faster-whisper.
- `workers/knowledge-worker`: child process Node para embeddings, índice y ranking.
- `packages/ai`: generación estructurada, embeddings, retrieval y respuesta con citas.

La documentación coincide en términos generales. El trabajo semántico pesado ya fue retirado de main. No hay paquete `design-system`, settings ni runner E2E pese a aparecer como objetivos de producto/auditoría.

## Dependency Map

```text
domain <- application <- infrastructure
domain <- recording
domain <- transcription
domain <- ai

renderer -> shared IPC contracts only
preload  -> shared IPC contracts + Electron
main     -> application + infrastructure + recording/transcription/ai adapters + worker client
```

No se observaron ciclos entre paquetes ni imports de infrastructure desde domain/application. `packages/infrastructure` implementa interfaces declaradas también en `packages/ai`; es una dependencia hacia un puerto, válida aunque convendría decidir a largo plazo si los puertos de conocimiento pertenecen a application.

## Critical Issues

No se confirmaron problemas CRITICAL. La auditoría no simuló corrupción física o corte eléctrico; por tanto no certifica ausencia absoluta de pérdida ante esos eventos.

## High Priority

### H1 — RESUELTO: inferencia y ranking vectorial fuera de Electron main

- Resolución: `KnowledgeWorkerClient` ejecuta un child process Node independiente para embeddings, indexación, retrieval y ranking. Los mensajes están tipados y validados; cancelación dura, timeout, crash y restart no terminan Electron main.
- Seguridad: el worker no recibe rutas de recordings ni modifica/elimina transcripts. El reemplazo del índice derivado conserva su transacción SQLite.
- Tests: startup, shutdown, index, query, cancel, crash, restart, mensajes inválidos y timeout forman parte de la suite automatizada.
- Build: Vite produce `dist/knowledge-worker/index.js` como entrypoint separado.
- Rendimiento: el benchmark sintético exacto registró para 1k/10k/100k un máximo de 14,7 ms de retraso en el coordinador. A 100k, query fue 276,0 ms, RSS del worker 188,3 MB y RSS del coordinador 40,2 MB.
- Evidencia: [ADR-knowledge-worker.md](../adr/ADR-knowledge-worker.md) y [KNOWLEDGE-WORKER.md](../performance/KNOWLEDGE-WORKER.md).
- Riesgo residual: M4 permanece abierto porque el scan/sort exacto sigue creciendo linealmente; no bloquea main, pero requiere benchmarks productivos antes de decidir `sqlite-vec`.

### H2 — Defensa Electron incompleta para navegación y permisos

- Ubicación: `apps/desktop/main/index.ts`.
- Problema: no se rechazan `window.open` ni navegaciones del renderer; el permission handler permite cualquier permiso `media` sin validar origen o tipo solicitado.
- Impacto: una inyección futura o navegación accidental ampliaría el alcance de la API privilegiada y de permisos multimedia.
- Importancia: contextBridge reduce superficie, pero la defensa en profundidad exige que solo el documento de Lecta use la ventana y solicite media.
- Recomendación: denegar nuevas ventanas/navegación, validar URL confiable, añadir `setPermissionCheckHandler`, restringir media al flujo esperado. Corrección segura incluida en esta auditoría.

### H3 — Validación IPC no impone todos los límites de recursos

- Ubicación: `recording-ipc.ts`, `ipc.ts`.
- Problema: fechas no se validan semánticamente; números aceptan `NaN`/`Infinity`; sample rate, duraciones, labels, device IDs, tags y textos carecen de límites homogéneos. El chunk individual sí tiene límite, pero no existe cuota por sesión en IPC/store.
- Impacto: renderer comprometido o defectuoso puede generar metadata inválida, consumo elevado de disco/memoria o estados irrecuperables.
- Importancia: IPC es un límite de confianza incluso en una aplicación local.
- Recomendación: validadores acotados y pruebas negativas; posteriormente cuota configurable de almacenamiento. Corrección segura de inputs incluida; la cuota requiere diseño de producto.

### H4 — Resuelto: E2E Electron y auditoría automática de accesibilidad

- Ubicación: configuración/tests del repositorio.
- Evidencia: diez pruebas cubren los siete flujos de producto y cuatro pruebas adicionales validan teclado, foco, movimiento reducido y reflow, incluyendo persistencia tras reinicio y cuatro fallos recuperables.
- Aislamiento: `LECTA_E2E=1` solo se acepta en main no empaquetado, cada prueba usa `userData` temporal y los adapters fixture no usan micrófono, loopback, Python, Whisper, modelos, APIs ni red.
- Accesibilidad: `@axe-core/playwright` valida Home, diálogo y sesión completada. Como correcciones derivadas se ajustó contraste y se añadieron roles/relaciones de tabs y tabpanels.
- CI: job E2E independiente, serial y offline con traces/screenshots únicamente en fallo. Evidencia local 2026-08-18: 14/14 E2E, 48/48 unit/integration, lint, typecheck, format y build correctos.

## Medium Priority

### M1 — Recuperación de AI/knowledge no está persistida como job

Cerrar Lecta durante generación de apuntes o indexación abandona progreso. Los artefactos previos se conservan y el guardado final es seguro, pero no hay job reiniciable ni estado visible. Crear una cola liviana persistida, sin mezclarla con estado de sesión.

### M2 — `App` y `HomeView` concentran estado, orquestación y presentación

`App.tsx` tiene ~313 líneas y `HomeView.tsx` ~370. La lógica de carga, errores, IA, recording, filtros y navegación está acoplada a componentes. Extraer hooks por capacidad (`useLibrary`, `useSessionRecording`, `useTranscription`) gradualmente, conservando los servicios fuera de React.

### M3 — Repositorios SQLite duplican apertura y migraciones

Cada store abre una conexión `DatabaseSync` y ejecuta un subconjunto de migraciones. WAL ayuda, pero aumenta coordinación y hace fácil omitir una migración. Crear un migrator único en composition root y factoría de conexiones; no usar un singleton global.

### M4 — Vector search exacto no escala a 10.000 sesiones

Complejidad aproximada por pregunta: O(n·d) para distancia + O(n log n) para sort, y todos los embeddings pasan a memoria. A 1.000 sesiones puede ser aceptable dependiendo de chunks; a 10.000 no. Aplicar heap top-k o extensión vectorial tras métricas.

### M5 — Filesystem no tiene política de cuotas, retención o integridad

La organización por `recordings/SESSION_ID` es buena. Faltan espacio libre previo, límites, hash/tamaño de chunks y manejo separado de directorios corruptos. `listIncomplete` aborta toda la lista si una metadata está corrupta, impidiendo recuperar grabaciones sanas.

### M6 — Errores técnicos llegan crudos a UI

Electron serializa mensajes como “Error invoking remote method…”. No hay envelope tipado con código, mensaje seguro y retryable. Esto reduce UX y puede filtrar detalles internos. Definir `IpcResult`/error mapper central, sin ocultar logs diagnósticos.

### M7 — Resuelto: accesibilidad automatizada y manual básica

El modal implementa Escape, focus trap y restauración; estados/progresos usan live regions sin anunciar el timer; errores usan alert; recorder muestra “Grabando”/“Pausado”; tabs implementan semántica y navegación APG. Playwright valida Tab, Shift+Tab, Enter, Space, flechas, Home, End, movimiento reducido y reflow 200 %. La guía y lista manual están en `docs/accessibility/ACCESSIBILITY.md`.

### M8 — Design System inexistente

`styles.css` tiene 965 líneas, alrededor de 80 valores hex únicos, radios/spacing/tamaños repetidos y clases de producto. Propuesta:

```text
renderer/design-system/
  tokens/{colors,typography,spacing,radius,shadows,motion}.css
  components/{Button,Input,Card,Modal,Select,Badge,EmptyState}.tsx
  icons/
  themes/light.css
```

Empezar con tokens CSS y Button/Input/Modal; no convertir elementos usados una sola vez en abstracciones.

### M9 — Búsqueda FTS y vector guardan texto duplicado

Transcripts existen en tabla de segmentos, FTS y knowledge chunks; embeddings añaden BLOB. Es deliberado para retrieval, pero aumenta backup/storage y requiere rebuild versionado. Documentar tamaños y proporcionar reconstrucción del índice derivado.

## Low Priority

- L1: strings de error mezclan español e inglés.
- L2: `session:list` sigue expuesto aunque Home usa búsqueda paginada; puede cargar todas las sesiones si se reutiliza incorrectamente.
- L3: no existe medición de cobertura ni thresholds por paquete.
- L4: dependencias con `latest` reducen builds reproducibles; el lockfile mitiga instalaciones existentes, no actualizaciones deliberadas.
- L5: `styles.css` y contratos compartidos crecerán como puntos de conflicto.
- L6: SQLite de Node emite advertencia experimental en tests; seguir evolución o fijar runtime soportado.

## Scalability Assessment

| Volumen     | Biblioteca/FTS                                                           | Transcripts/UI                                                                | Vectores                                                                | Filesystem                                              |
| ----------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------- |
| 10 sesiones | Sin riesgo                                                               | Solo se carga transcript seleccionado                                         | Irrelevante                                                             | Simple                                                  |
| 1.000       | Índices/paginación adecuados; cuatro queries iniciales                   | Correcto si segmentos por sesión son moderados                                | Primera indexación y scan perceptibles                                  | Miles de directorios tolerables                         |
| 10.000      | FTS sigue siendo viable; `listSubjects DISTINCT` y conteos deben medirse | No cargar `session:list`; transcript individual puede requerir virtualización | Worker evita bloqueo; latencia/memoria aún pueden requerir índice top-k | Requiere cuotas, diagnóstico de espacio y mantenimiento |

No se detectó N+1 en Home. `SqliteKnowledgeStore.list()` sí realiza 1 query de transcripts + 1 query por transcript durante indexación: N+1 de alta latencia a gran escala. `enrich()` realiza una query por match (máximo pequeño). `listIncomplete()` recorre todos los directorios secuencialmente al startup.

## Security Review

- Correcto: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, CSP restrictiva, protocolo propio acotado, IDs validados para filesystem, API preload por capacidad, sin Node/SQLite/filesystem en React.
- Pendiente: navegación/window-open, origen de permisos, límites IPC completos, error envelopes y almacenamiento seguro de API key para distribución.
- La API key en `.env` es aceptable para desarrollo, no para producto. En release usar Credential Manager/DPAPI mediante un adapter; nunca mover el secreto al renderer.
- No hay renderizado HTML sin sanitizar; React escapa transcript y texto de IA.

## Failure Recovery

- Recording crash: chunks y metadata sobreviven; recuperación/discard existe. Falta tolerar una metadata corrupta sin bloquear las demás.
- Transcription crash/app close: jobs activos se marcan FAILED al iniciar y pueden reiniciarse; audio permanece.
- AI crash: notas previas permanecen y solo se guarda output válido; no hay job reanudable.
- Knowledge crash: reemplazo vectorial usa transacción; reintento reindexa; no afecta fuentes primarias.
- Database locked: errores suben a UI, sin retry/backoff central ni pantalla de recuperación.
- Archivo de audio ausente: protocolo/worker fallan; UI no distingue archivo perdido de fallo genérico.

## Test Pyramid and E2E Strategy

### Actual

- Unit: dominio, chunkers, schemas, providers mock, recording adapter.
- Integration: SQLite sessions/transcripts/notes/library/vectors y transcription queue.
- E2E: 14 escenarios Playwright Electron.

### Implementado

1. `tests/e2e/fixtures`: userData temporal, audio WebM corto, transcript y respuestas IA deterministas.
2. Composition root acepta adapters solo cuando `LECTA_E2E=1`; nunca desde renderer.
3. Playwright `_electron.launch` abre el build, inspecciona ventana y reinicia con el mismo userData para persistencia.
4. Los flujos 1–7 usan recording fixture, fake transcription provider y fake AI/embedding provider; CI no usa micrófono, loopback, Whisper, modelos ni red.
5. Cada test limpia su userData y verifica que no quedan child processes.
6. `@axe-core/playwright` se ejecuta en Home, modal y sesión completada.

Flujos prioritarios: lifecycle de sesión; persistencia tras reinicio; transcription fixture; notes mock; search/filter/open; Ask con fuente/timestamp; matriz de fallos recuperables.

## Visual Regression Strategy

Snapshots en Windows con viewport fijo para Home, modal, recording, paused, transcript, notes, library y Ask. “Settings” no existe y no debe inventarse en esta tarea. Enmascarar timer, fechas, duración, progreso, audio controls nativos y texto proveniente de modelos. Capturar regiones estables por componente, no la ventana completa en todos los tests. Umbral pequeño y revisión humana de baselines.

## Performance Evidence and Plan

Existe un harness reproducible para indexación/ranking semántico sintético y se documenta en `docs/performance/KNOWLEDGE-WORKER.md`. No mide startup/CPU global ni inferencia ONNX como garantía. La inspección confirma escritura secuencial de chunks y máximo un Whisper activo. Permanecen necesarias mediciones repetibles de:

- tiempo desde launch hasta Home interactivo;
- working set idle y durante fixture de grabación de 10 minutos;
- latencia p50/p95 de FTS con 1k/10k sesiones sintéticas;
- indexación y query vectorial productiva por 1k/10k/100k chunks y varias corridas;
- apertura/scroll de transcript de 10k segmentos.

Presupuestos iniciales propuestos: Home interactivo &lt;2 s en equipo objetivo, FTS p95 &lt;150 ms, ninguna tarea main >50 ms, crecimiento RAM durante grabación acotado y estable.

## Technical Debt

- El worker de conocimiento existe; falta decidir un índice escalable solo si benchmarks productivos superan presupuestos.
- Falta migrator central.
- Falta error model IPC.
- UI carece de routing/state boundaries y design system.
- No hay release packaging/signing/auto-update auditado.
- No hay backups/export/repair de SQLite e índices derivados.
- No hay telemetría local opt-in ni logging a archivo para soporte.

## Recommended Roadmap

1. **Release safety:** aplicar hardening Electron y límites IPC; corregir formato; añadir pruebas negativas.
2. **Testability seam:** ADR de composition root para fixtures; Playwright Electron con flujos 1, 2 y 7.
3. **Critical workflows:** completar flujos 3–6 con mocks y axe; visual baselines estables.
4. **Responsiveness:** completado el aislamiento de knowledge; repetir benchmark productivo antes de decidir exact scan vs sqlite-vec.
5. **Recovery:** tolerancia a metadata corrupta, error envelopes, DB locked/backoff y diagnóstico de archivos.
6. **Frontend:** tokens y tres componentes base; dividir hooks por capacidad; accesibilidad teclado completa.
7. **Operación:** secure secret storage, packaging firmado, backup/restore y matriz de Windows soportada.

## Before vs After

### Before

- Lint: PASS
- Typecheck: PASS
- Unit/integration: PASS, 39/39
- Build: PASS
- Format: FAIL, 2 archivos
- E2E: no configurado
- Accesibilidad automatizada: no configurada

### After

- Lint: PASS
- Typecheck: PASS
- Unit/integration: PASS, 48/48
- Build renderer/main/preload/knowledge-worker: PASS
- Format: PASS
- E2E: PASS, 14/14 escenarios Playwright Electron offline
- Accesibilidad automatizada: PASS en Home, modal y sesión completada mediante axe
- Regresiones detectadas: ninguna en la suite disponible

## Safe Corrections Applied

1. Electron deniega nuevas ventanas y navegaciones fuera del documento/origen de Lecta.
2. Los permisos `media` requieren un renderer confiable tanto en request como en permission check.
3. IPC de grabación valida fechas, números finitos, sample rate, duración y límites de metadata/dispositivos.
4. IPC de sesión/biblioteca limita título, materia, tags, filtros y paginación.
5. El modal responde a Escape; errores relevantes usan `role=alert`; Ask tiene nombre accesible y existe foco visible consistente.
6. Se corrigieron los dos archivos que hacían fallar `format:check`.
7. Playwright Electron usa `userData` temporal, fixtures deterministas y verifica limpieza del proceso.
8. Las pestañas de materiales exponen roles y relaciones ARIA; se corrigieron contrastes detectados por axe.

H1 fue resuelto mediante child process, protocolo tipado, recuperación, tests y benchmark 1k/10k/100k. H4 fue resuelto mediante el seam documentado en ADR, Playwright Electron, fixtures offline, aislamiento de datos y evidencia local verde.
