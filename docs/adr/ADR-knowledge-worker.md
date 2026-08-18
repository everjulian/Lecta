# ADR — Knowledge Worker fuera de Electron main

- Estado: aceptado
- Fecha: 2026-08-17
- Alcance: embeddings, indexación, recuperación y ranking vectorial
- Resuelve: `QUALITY-AUDIT.md` H1, condicionado a evidencia automatizada y benchmarks

## Contexto

La implementación inicial crea `TransformersEmbeddingProvider` y ejecuta
`IndexKnowledge`, `KnowledgeRetriever` y `SqliteKnowledgeStore.search` desde el
proceso Electron main. La inferencia ONNX, la lectura de BLOBs, el cálculo de
similitud y el ordenamiento completo compiten así con lifecycle, IPC,
persistencia y coordinación de grabación.

El índice semántico es derivado: puede reconstruirse desde transcripts, pero el
audio y los transcripts son fuentes primarias y el worker nunca debe
modificarlos ni eliminarlos.

## Opciones evaluadas

### Worker Threads

Ventajas:

- menor latencia de inicio y menor memoria base;
- mensajería estructurada nativa y transferencia eficiente de buffers;
- empaquetado sencillo dentro del runtime Node de Electron.

Desventajas:

- comparte proceso y límites de memoria con Electron main;
- una caída nativa de ONNX o SQLite puede terminar el proceso completo;
- aislamiento y recuperación son menores para una tarea derivada y pesada;
- cancelar inferencia nativa puede requerir terminar el thread y reconstruir su
  estado igualmente.

### Child Process

Ventajas:

- aislamiento de memoria, event loop y fallos nativos;
- cancelación dura mediante terminación del proceso;
- reinicio independiente sin cerrar Lecta;
- métricas de memoria y lifecycle observables por PID;
- coherente con el límite ya usado por faster-whisper.

Desventajas:

- mayor costo de arranque y memoria;
- los mensajes se serializan y no deben transportar objetos complejos;
- exige incluir un entrypoint adicional en el build/paquete Electron;
- requiere lifecycle, timeout y recuperación explícitos.

## Decisión

Usar un **Child Process de Node** dedicado y de instancia única. Electron main
lo controla mediante `KnowledgeWorkerClient`; el proceso hijo crea el provider
de embeddings y su propia conexión SQLite WAL. Solo ejecuta indexación y
retrieval vectorial. La obtención de metadata de sesión y la síntesis mediante
`AIProvider` permanecen en application/main porque no realizan ranking local
intensivo y mantienen las citas bajo control de la aplicación.

No se introduce `sqlite-vec`. Primero se conserva el algoritmo exacto actual,
se mueve fuera de main y se mide con 1k, 10k y 100k chunks.

## Protocolo

Todos los mensajes son objetos planos validados en ambos extremos. Nunca se
envían objetos Electron, conexiones SQLite, providers ni errores sin
normalizar.

Main hacia worker:

- `INDEX_START`: `requestId`.
- `QUERY_START`: `requestId`, pregunta y límite.
- `CANCEL`: `requestId`.

Worker hacia main:

- `INDEX_PROGRESS`: `requestId`, completados, total y porcentaje.
- `INDEX_COMPLETE`: `requestId`, cantidad indexada y duración.
- `INDEX_FAILED`: `requestId`, error recuperable normalizado.
- `QUERY_PROGRESS`: `requestId`, fase y porcentaje cuando sea estimable.
- `QUERY_COMPLETE`: `requestId`, matches y duración.
- `QUERY_FAILED`: `requestId`, error recuperable normalizado.

Los tipos discriminados viven junto al worker y sus validadores rechazan tipos,
campos, límites o mensajes desconocidos.

## Lifecycle, cancelación y recuperación

- El cliente inicia el worker bajo demanda y espera una señal de disponibilidad.
- Solo una operación pesada se ejecuta a la vez; solicitudes adicionales se
  coordinan en main.
- `AbortSignal` envía `CANCEL`. Si la operación no coopera durante una llamada
  nativa, main termina el child process para garantizar cancelación y rechaza
  la solicitud con un error recuperable.
- Exit, disconnect, mensaje inválido y timeout rechazan todas las operaciones
  pendientes, pero nunca cierran Lecta.
- La siguiente operación puede iniciar un worker limpio; también existe
  `restart()` explícito.
- `shutdown()` cancela pendientes y espera salida con un límite corto antes de
  terminar el proceso.

Una transacción de reemplazo vectorial conserva atomicidad. Un crash puede
dejar el índice anterior o la transacción revertida; nunca elimina transcripts.

## Seguridad de grabación

El proceso hijo no recibe rutas de recordings ni capacidades para controlarlas.
Solo conoce la base SQLite y el directorio de caché de embeddings. No importa
Electron y no participa en `RecordingEngine`, IPC multimedia ni filesystem de
grabaciones. Main no espera al worker en ninguna ruta de start/pause/stop de
grabación.

## Empaquetado

Vite genera un entrypoint Node independiente en
`dist/knowledge-worker/index.js`. Electron main usa `fork` con IPC habilitado y
argumentos de configuración validados. Las dependencias del modelo permanecen
resueltas por el paquete de la aplicación. El build debe fallar si el entrypoint
no puede generarse.

## Observabilidad

El cliente recibe duración y progreso por operación. El harness de rendimiento
registra:

- duración de indexación;
- latencia de query;
- retraso máximo del event loop de main durante el trabajo;
- memoria RSS del worker y del proceso coordinador.

Los logs pasan por `Logger`; el protocolo no usa `console.log` para datos de
producto ni incluye texto completo en errores.

## Evidencia requerida para cerrar H1

1. Tests de startup, shutdown, index, query, cancel, crash, restart, mensajes
   inválidos y timeout.
2. Build que produzca el worker separado.
3. Benchmark reproducible para 1k, 10k y 100k chunks con resultados documentados.
4. Evidencia de que el event loop coordinador continúa respondiendo durante el
   ranking.
5. Lint, typecheck, tests y build verdes.

Si 100k excede los presupuestos documentados, H1 puede considerarse resuelto
respecto al bloqueo de main, pero se mantendrá una deuda separada de escalado
del índice. Solo esa evidencia puede justificar evaluar `sqlite-vec`.

## Consecuencias

- Electron main queda como coordinador y conserva control de citas y errores.
- El aislamiento mejora a cambio de memoria base y complejidad de lifecycle.
- Los tests pueden sustituir el proceso mediante una factoría inyectada sin
  cargar ONNX ni descargar modelos.
- El índice sigue siendo exacto y lineal inicialmente; moverlo evita congelar
  main, pero no reduce por sí mismo su costo total.
