# Pruebas E2E de Electron

## Alcance

La suite inicia el build real de Electron con Playwright y recorre renderer, preload, IPC, casos de uso, SQLite y filesystem. Cubre el ciclo de sesión, persistencia tras reinicio, transcripción, apuntes, biblioteca, preguntas con fuentes y fallos recuperables. Axe aplica el quality gate de accesibilidad y pruebas adicionales validan teclado, foco, movimiento reducido y reflow equivalente a zoom 200 %.

## Modo aislado

Playwright establece `LECTA_E2E=1` en el environment del proceso main. Main valida además una ruta absoluta en `LECTA_E2E_USER_DATA` y rechaza el modo en aplicaciones empaquetadas. El renderer solo puede leer que el modo está activo; no puede activarlo.

Cada test recibe un directorio temporal independiente. SQLite, grabaciones fixture y preferencias se escriben allí y se eliminan al finalizar. La prueba de persistencia reinicia Electron conservando exclusivamente ese directorio temporal.

El composition root sustituye únicamente los puertos externos:

- `FakeRecordingEngine` escribe chunks pequeños y deterministas por el preload/IPC real.
- `FakeTranscriptionProvider` produce segmentos conocidos sin Python, Whisper ni modelos.
- `FakeAIProvider` produce apuntes y respuestas conocidas sin API ni credenciales.
- `FakeKnowledgeWorker` devuelve fuentes locales deterministas sin embeddings ni child process.

Los escenarios de error se seleccionan con `LECTA_E2E_SCENARIO`: `transcription-failure`, `ai-timeout`, `knowledge-failure` y `missing-recording`. Esta variable también se valida en main.

## Ejecución local

Desde la raíz del repositorio:

```bash
pnpm install --frozen-lockfile
pnpm test:e2e
```

La suite construye Lecta antes de iniciar Electron. No requiere micrófono, audio loopback, modelos, API key ni Internet.

## CI y artefactos

El job `E2E` se ejecuta después de `Quality` mediante `xvfb-run` en Linux. Las variables de Hugging Face y Transformers fuerzan modo offline. Playwright usa un único worker para evitar competencia entre instancias de Electron.

Screenshots y traces se conservan únicamente cuando una prueba falla, en `test-results/e2e`, y GitHub Actions los publica durante siete días. Un trace puede abrirse localmente con:

```bash
pnpm exec playwright show-trace test-results/e2e/<prueba>/trace.zip
```

## Limpieza de procesos

Cada teardown cierra `ElectronApplication` y comprueba que su PID terminó antes de borrar `userData`. Los fakes E2E no crean workers de conocimiento ni procesos Python, por lo que la suite no deja Whisper ni procesos auxiliares activos. Un fallo de aserción también ejecuta el teardown y conserva el diagnóstico.

La decisión de diseño y sus límites están en [ADR-e2e-test-seam.md](../adr/ADR-e2e-test-seam.md).
El alcance de accesibilidad y la lista manual están en [ACCESSIBILITY.md](../accessibility/ACCESSIBILITY.md).
