# ADR-006: notas estructuradas mediante un proveedor de IA

## Estado

Aceptado.

## Decisión

La generación de apuntes se implementa como un artefacto derivado de `Transcript`. La aplicación depende de los puertos `AIProvider`, `TranscriptReader` y `StructuredNotesRepository`. El adapter inicial usa una API compatible con Chat Completions configurada exclusivamente mediante variables de entorno.

Las transcripciones se dividen respetando segmentos y timestamps. Cada fragmento se resume secuencialmente y una segunda etapa sintetiza un resultado validado contra un esquema explícito. Solo se persiste un resultado final válido. Regenerar reemplaza únicamente el contenido derivado.

## Seguridad y trade-offs

- `LECTA_AI_API_KEY` nunca se persiste ni se expone por IPC.
- URL y modelo son configurables sin modificar código.
- Timeout y reintentos están acotados.
- Un fallo de IA no altera la sesión, el audio ni la transcripción.
- Las variables de entorno son adecuadas para desarrollo; una futura configuración visual deberá usar el almacén seguro del sistema operativo.
- El procesamiento secuencial reduce picos de recursos, a costa de mayor latencia.
