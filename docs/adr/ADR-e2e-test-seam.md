# ADR — Seam de fixtures para E2E de Electron

- Estado: aceptado
- Fecha: 2026-08-18
- Alcance: pruebas E2E de renderer, preload, IPC, application y persistencia
- Resuelve: `QUALITY-AUDIT.md` H4, sujeto a CI verde

## Contexto

Los flujos críticos de Lecta cruzan renderer, preload, IPC, casos de uso y
SQLite. Las pruebas unitarias no detectan fallos de wiring o persistencia entre
reinicios. Ejecutar grabación, Whisper, modelos o APIs reales en CI sería
inestable, lento, costoso y contrario a privacidad.

## Decisión

Playwright inicia el build real de Electron con `LECTA_E2E=1` y un directorio
`userData` temporal por prueba. Main valida el modo antes de `app.whenReady()` y
lo rechaza en una aplicación empaquetada. El renderer no puede activarlo; solo
recibe desde preload una capacidad de runtime de solo lectura para seleccionar
el `FakeRecordingEngine`.

El composition root selecciona exclusivamente en ese modo:

- `FakeTranscriptionProvider`;
- `FakeAIProvider`;
- `FakeKnowledgeWorker` con retrieval determinista;
- stores SQLite y filesystem reales, pero confinados al `userData` temporal.

El `FakeRecordingEngine` conserva el flujo renderer → preload → IPC → store:
genera un chunk mínimo determinista y metadata sin pedir micrófono, loopback ni
permisos multimedia.

Los escenarios de fallo se eligen mediante `LECTA_E2E_SCENARIO`, validado en
main. No existe canal IPC para cambiarlo durante una ejecución.

## Seguridad y aislamiento

- E2E solo se activa desde environment del proceso principal y cuando
  `app.isPackaged === false`.
- El launcher no reenvía `.env`, API keys ni tokens.
- Playwright ejecuta el contexto offline.
- Ningún fixture inicia Python, knowledge worker, ONNX, Whisper o servicios
  remotos.
- Cada prueba crea y elimina su propio directorio temporal después de cerrar
  Electron.
- El cierre espera el proceso principal y comprueba que su PID ya no exista.

## Fixtures frente a mocks de UI

No se sustituye `window.lecta` ni se evita IPC. Los fakes implementan puertos en
los límites arquitectónicos existentes, de modo que las pruebas ejercitan el
wiring real. La única selección en renderer es el recording engine, porque la
captura real reside deliberadamente allí.

## Artefactos

Tracing y screenshots se capturan durante la prueba pero solo se adjuntan y
conservan cuando falla. CI sube `test-results/` únicamente en fallo.

## Trade-offs

- Los fixtures prueban integración y UX, no compatibilidad física de micrófono,
  loopback ni calidad de modelos.
- Mantener escenarios deterministas añade código de soporte, pero aislado bajo
  `apps/desktop/main/e2e` y `renderer/recording`.
- Un worker de Playwright reduce paralelismo, pero evita interferencia de
  procesos y hace reproducibles los reinicios con el mismo `userData`.
- La suite prueba el build unpackaged; packaging firmado requiere una fase
  separada.
