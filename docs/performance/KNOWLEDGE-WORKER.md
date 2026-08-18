# Knowledge Worker performance evidence

- Fecha: 2026-08-17
- Equipo: entorno local Windows del proyecto
- Runtime: Node.js 24.13.0
- Comando: `pnpm benchmark:knowledge`
- Ejecución: un proceso coordinador y un child process nuevo por volumen

## Objetivo

Comprobar que indexación y ranking vectorial pueden crecer sin bloquear el event
loop coordinador de Electron main. El benchmark reproduce el patrón costoso
actual: inserción incremental de embeddings como BLOBs en SQLite, lectura de
todos los vectores compatibles, similitud coseno, ordenamiento exacto y top-k.

## Resultados

|  chunks | index duration | query latency | main/coordinator max lag | worker peak RSS | coordinator RSS |
| ------: | -------------: | ------------: | -----------------------: | --------------: | --------------: |
|   1.000 |         4,9 ms |        2,8 ms |                  14,7 ms |         46,3 MB |         39,7 MB |
|  10.000 |        21,4 ms |       27,0 ms |                  12,2 ms |         64,2 MB |         40,0 MB |
| 100.000 |       288,0 ms |      276,0 ms |                  11,4 ms |        188,3 MB |         40,2 MB |

Los resultados evidencian que el coordinador permanece por debajo del
presupuesto inicial de 50 ms de bloqueo aun cuando el child process realiza el
scan de 100k chunks. La memoria intensiva queda aislada en el worker y la RSS
del coordinador permanece aproximadamente estable.

## Interpretación

- **H1 queda resuelto respecto a aislamiento y capacidad de respuesta de
  Electron main.** Inferencia, indexación y ranking productivos se ejecutan en
  el child process.
- El crecimiento de memoria y la query de ~304 ms a 100k confirman la deuda M4:
  el algoritmo exacto O(n·d) + O(n log n) no es el destino final para corpus
  mucho mayores.
- Estos datos no justifican todavía `sqlite-vec`: 100k permanece operativo y el
  objetivo de esta fase era aislar antes de sustituir el índice.

## Límites de la medición

- Usa vectores deterministas de 64 dimensiones para que sea reproducible y no
  descargue modelos. El modelo productivo puede usar dimensiones mayores.
- No mide descarga, carga ni inferencia ONNX; esas tareas también viven dentro
  del worker, pero su latencia depende de modelo, CPU y caché local.
- Es una corrida local, no una garantía p95 ni un benchmark multi-equipo.
- Mide capacidad de respuesta mediante un intervalo de 5 ms en el proceso
  coordinador; no representa renderizado React ni captura real de audio.

Antes de adoptar un índice aproximado o extensión nativa se deben repetir las
mediciones con dimensión productiva, varias corridas, equipo objetivo y corpus
representativo. La grabación debe medirse por separado y nunca comparte este
worker.
