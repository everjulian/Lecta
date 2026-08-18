# Auditoría integral de calidad de Lecta

- Fecha: 2026-08-13
- Alcance: código fuente, configuración, migraciones, tests y documentación presentes en el repositorio
- Baseline: lint y typecheck correctos; 39 tests correctos; build correcto; `format:check` falló en 2 archivos
- Método: inspección estática, ejecución de validaciones, revisión de contratos y rutas de fallo, análisis de queries/índices y conteo de complejidad visual

## Executive Summary

Lecta conserva una dirección de dependencias saludable y protege correctamente el dominio de Electron, React, SQLite y proveedores. La grabación incremental, la cola de transcripción y los artefactos derivados son buenas decisiones. No se identificó una vulnerabilidad crítica explotable con la superficie actual.

Todavía no debe considerarse release-ready. Faltan defensa en profundidad de navegación/permisos Electron, límites completos en IPC, E2E real, accesibilidad automatizada y medición reproducible de rendimiento. La búsqueda vectorial ejecuta inferencia y ranking lineal en Electron main; esto comprometerá capacidad de respuesta al crecer el corpus. La UI funciona, pero `App`, `HomeView` y una hoja CSS de 965 líneas concentran demasiadas responsabilidades.

| Área            | Puntuación /10 | Evidencia resumida                                                                  |
| --------------- | -------------: | ----------------------------------------------------------------------------------- |
| Architecture    |              8 | Capas claras y puertos; composition root correcto; trabajo semántico pesado en main |
| Code Quality    |              7 | strict, sin `any`, `@ts-ignore` ni logging disperso; componentes/archivos grandes   |
| Testing         |              5 | 39 unit/integration tests; cero E2E, visual regression o fallos UI automatizados    |
| Security        |              7 | aislamiento, sandbox, CSP e IPC explícito; permisos/navegación e inputs mejorables  |
| Performance     |              6 | paginación/FTS/chunks; vector scan e inferencia en main; sin benchmark estable      |
| Accessibility   |              4 | labels y roles parciales; sin axe, focus trap, Escape ni prueba teclado completa    |
| Design System   |              3 | lenguaje visual coherente, pero sin tokens/componentes base y ~80 colores hex       |
| Maintainability |              6 | paquetes pequeños en backend; `HomeView`, `App` y CSS concentran cambios            |
| Scalability     |              6 | 1.000 sesiones razonables para biblioteca; 10.000 penalizan vectores y filesystem   |

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
                 <- EmbeddingProvider -> Transformers.js/ONNX
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
- `packages/ai`: generación estructurada, embeddings, retrieval y respuesta con citas.

La documentación coincide en términos generales. Desviaciones: `ARCHITECTURE.md` todavía describe algunos modelos como “iniciales”; la IA semántica se ejecuta actualmente en main aunque el principio general exige sacar procesamiento pesado de la UI y de la ruta de grabación. No hay paquete `design-system`, settings ni runner E2E pese a aparecer como objetivos de producto/auditoría.

## Dependency Map

```text
domain <- application <- infrastructure
domain <- recording
domain <- transcription
domain <- ai

renderer -> shared IPC contracts only
preload  -> shared IPC contracts + Electron
main     -> application + infrastructure + recording/transcription/ai adapters
```

No se observaron ciclos entre paquetes ni imports de infrastructure desde domain/application. `packages/infrastructure` implementa interfaces declaradas también en `packages/ai`; es una dependencia hacia un puerto, válida aunque convendría decidir a largo plazo si los puertos de conocimiento pertenecen a application.

## Critical Issues

No se confirmaron problemas CRITICAL. La auditoría no simuló corrupción física o corte eléctrico; por tanto no certifica ausencia absoluta de pérdida ante esos eventos.

## High Priority

### H1 — Inferencia y ranking vectorial bloquean Electron main

- Ubicación: `TransformersEmbeddingProvider`, `IndexKnowledge`, `SqliteKnowledgeStore.search`, `knowledge-ipc.ts`.
- Problema: la primera pregunta indexa todos los transcripts secuencialmente y el ranking carga todos los BLOB del modelo, calcula coseno y ordena en JS dentro de main.
- Impacto: con miles de chunks la ventana puede congelarse; IPC, lifecycle y persistencia compiten con CPU/IO. A 10.000 sesiones el scan lineal y el sort completo no son aceptables.
- Importancia: una UI congelada durante recording o recuperación es un riesgo de producto aunque la captura viva parcialmente en renderer.
- Recomendación: ADR para `knowledge-worker`; mover embeddings/indexación/ranking a worker thread o child process. Introducir búsqueda top-k nativa (`sqlite-vec`) solo tras benchmark y plan de empaquetado. Mostrar progreso/cancelación. No se corrige automáticamente por ser un cambio arquitectónico grande.

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

### H4 — No existe E2E ni auditoría automática de accesibilidad

- Ubicación: configuración/tests del repositorio.
- Problema: Vitest cubre dominio, stores, queue y adapters, pero no inicia Electron ni prueba renderer + preload + IPC + persistencia. No hay Playwright, axe ni snapshots.
- Impacto: regresiones en empaquetado, preload, canales, teclado y wiring pueden pasar con 39 tests verdes.
- Importancia: los siete flujos críticos cruzan procesos y no quedan certificados por tests unitarios.
- Recomendación: añadir Playwright Electron con `LECTA_E2E=1`, userData temporal y adapters fixture. No activar audio/Whisper/red. Añadir `@axe-core/playwright`. Requiere un ADR/fixture seam antes de implementarse para no contaminar producción.

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

### M7 — Accesibilidad manual incompleta

El modal no implementa Escape ni focus trap/restore. Mensajes de error/progreso no tienen `aria-live`; focus visible depende del navegador y no está diseñado; el input de Ask carece de label programático explícito; tabs visuales no implementan semántica completa (`role=tab`, `aria-selected`, panel). Corregir por componentes base y validar solo con teclado.

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

| Volumen     | Biblioteca/FTS                                                           | Transcripts/UI                                                                | Vectores                                                 | Filesystem                                              |
| ----------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| 10 sesiones | Sin riesgo                                                               | Solo se carga transcript seleccionado                                         | Irrelevante                                              | Simple                                                  |
| 1.000       | Índices/paginación adecuados; cuatro queries iniciales                   | Correcto si segmentos por sesión son moderados                                | Primera indexación y scan perceptibles                   | Miles de directorios tolerables                         |
| 10.000      | FTS sigue siendo viable; `listSubjects DISTINCT` y conteos deben medirse | No cargar `session:list`; transcript individual puede requerir virtualización | Bloqueo/memoria probable; requiere worker + índice top-k | Requiere cuotas, diagnóstico de espacio y mantenimiento |

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
- E2E: inexistente.

### Propuesta

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

No existe harness de benchmark; por ello no se adjudican cifras de startup/CPU como garantía. La inspección confirma escritura secuencial de chunks y máximo un Whisper activo. Añadir mediciones repetibles de:

- tiempo desde launch hasta Home interactivo;
- working set idle y durante fixture de grabación de 10 minutos;
- latencia p50/p95 de FTS con 1k/10k sesiones sintéticas;
- indexación y query vectorial por 1k/10k/100k chunks;
- apertura/scroll de transcript de 10k segmentos.

Presupuestos iniciales propuestos: Home interactivo <2 s en equipo objetivo, FTS p95 <150 ms, ninguna tarea main >50 ms, crecimiento RAM durante grabación acotado y estable.

## Technical Debt

- Falta proceso worker para conocimiento.
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
4. **Responsiveness:** mover knowledge a worker y medir 1k/10k; decidir exact scan vs sqlite-vec.
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
- Unit/integration: PASS, 39/39
- Build renderer/main/preload: PASS
- Format: PASS
- E2E: no configurado; estrategia y seam requerido documentados
- Accesibilidad automatizada: no configurada; análisis y plan axe documentados
- Regresiones detectadas: ninguna en la suite disponible

## Safe Corrections Applied

1. Electron deniega nuevas ventanas y navegaciones fuera del documento/origen de Lecta.
2. Los permisos `media` requieren un renderer confiable tanto en request como en permission check.
3. IPC de grabación valida fechas, números finitos, sample rate, duración y límites de metadata/dispositivos.
4. IPC de sesión/biblioteca limita título, materia, tags, filtros y paginación.
5. El modal responde a Escape; errores relevantes usan `role=alert`; Ask tiene nombre accesible y existe foco visible consistente.
6. Se corrigieron los dos archivos que hacían fallar `format:check`.

Los riesgos H1 y H4 permanecen abiertos deliberadamente: mover conocimiento a worker y crear fixtures E2E son cambios de arquitectura/testabilidad que deben ejecutarse como tareas separadas con ADR y validación incremental, no como refactor oportunista dentro de la auditoría.
