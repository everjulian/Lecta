# ADR-004: Captura de audio de Windows

- Estado: aceptado
- Fecha: 2026-08-07

## Decisión

Capturar audio del sistema con `session.setDisplayMediaRequestHandler`, `desktopCapturer` y el dispositivo `loopback` de Electron. El renderer solicita `getDisplayMedia` solo después de una acción del usuario, descarta inmediatamente la pista de video y mezcla la pista loopback con el micrófono seleccionado mediante Web Audio API.

La mezcla aplica ganancia 0.7 a cada entrada para conservar headroom. `MediaRecorder` codifica WebM/Opus a 128 kbit/s y entrega fragmentos aproximadamente cada cinco segundos. Cada fragmento cruza un contrato IPC limitado y se escribe inmediatamente en filesystem; además se anexa a `recording.webm`.

## Recuperación

Antes de comenzar se crea `metadata.json` con estado `RECORDING`. Sus escrituras son atómicas. Un estado `RECORDING` o `PAUSED` al reiniciar se considera incompleto y se ofrece para recuperar o descartar. Los chunks no se eliminan durante la recuperación.

## Consecuencias y limitaciones

- Loopback de Electron está soportado actualmente solo en Windows.
- Chromium requiere solicitar una fuente de pantalla para obtener loopback; no se almacena video.
- Contenido protegido por DRM o rutas de audio exclusivas puede entregar silencio.
- Cambiar o desconectar el micrófono durante una sesión no conmuta automáticamente a otro dispositivo.
- Suspensión de Windows y cambios de dispositivo pueden retrasar los eventos de chunks.
- Un WebM recuperado tras un cierre abrupto puede carecer del cierre normal del contenedor; sus bytes permanecen disponibles y suele ser reproducible, pero podrá requerir remuxing en una fase posterior.
- Durante grabación no se ejecutan Whisper, IA ni consolidación pesada.

## Referencias

- https://www.electronjs.org/docs/latest/api/session#sessetdisplaymediarequesthandlerhandler-opts
- https://www.electronjs.org/docs/latest/api/desktop-capturer
- https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/start
- https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaStreamDestination
