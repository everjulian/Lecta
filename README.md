# Lecta

Lecta es una aplicación desktop local-first para capturar clases y reuniones y, en fases futuras, transcribirlas y generar material de estudio con IA.

Lecta incluye sesiones persistentes en SQLite, grabación real en Windows de audio del sistema y micrófono, transcripción offline con faster-whisper y generación configurable de material de estudio con IA. La captura usa chunks WebM/Opus recuperables y nunca ejecuta transcripción ni IA mientras está grabando.

## Requisitos y comandos

- Node.js 22 o superior
- pnpm 10 o superior

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm setup:transcription
```

## Organización

- `apps/desktop`: proceso main, preload seguro y renderer React.
- `packages/domain`: entidades y reglas puras.
- `packages/application`: casos de uso y puertos.
- `packages/infrastructure`: adapters técnicos para SQLite y memoria.
- `packages/recording`, `transcription`, `ai`: límites independientes para captura, transcripción y material derivado.
- `packages/shared`: abstracciones transversales pequeñas.
- `workers`: procesos pesados futuros.
- `tests`: pruebas de dominio y aplicación.

Consulta [ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) para las reglas de dependencia.

## Archivos de audio

Las grabaciones se guardan en el directorio de datos de usuario de Electron, dentro de `recordings/SESSION_ID/`. `recording.webm` es el archivo reproducible; `chunks/` y `metadata.json` permiten recuperación ante cierres inesperados. La captura loopback actual es específica de Windows y puede no incluir contenido protegido por DRM.

## Transcripción offline

En Windows instala una vez el runtime local:

```powershell
pnpm setup:transcription
```

Requiere Python 3.11 o 3.12. El primer uso de cada modelo descarga `small` o `medium` al directorio de datos de Lecta; después se reutiliza localmente. Las pruebas automatizadas usan providers mock y nunca descargan modelos.

## Generación de apuntes con IA

Para desarrollo, copia `.env.example` como `.env` en la raíz del proyecto y coloca allí tu clave:

```dotenv
LECTA_AI_API_KEY=tu_clave
LECTA_AI_BASE_URL=https://api.openai.com/v1
LECTA_AI_MODEL=gpt-4.1-mini
```

También puedes configurar el adapter temporalmente desde PowerShell:

```powershell
$env:LECTA_AI_API_KEY="tu-clave"
$env:LECTA_AI_BASE_URL="https://api.openai.com/v1"
$env:LECTA_AI_MODEL="gpt-4.1-mini"
pnpm dev
```

La clave solo se lee en Electron main: no se guarda en SQLite ni se expone al renderer. URL y modelo pueden cambiarse para usar otro proveedor compatible.

## Preguntar a Lecta

La búsqueda semántica genera embeddings localmente con un modelo ONNX multilingüe. En la primera pregunta, Lecta descarga el modelo una sola vez al directorio local de modelos; las consultas posteriores pueden recuperar fuentes sin conexión. Los vectores, fragmentos, sesiones y timestamps permanecen en SQLite. Si se usa el proveedor de IA para redactar la respuesta, solo se envían la pregunta y los pocos fragmentos recuperados, nunca el audio ni la biblioteca completa.

El modelo puede cambiarse mediante `LECTA_EMBEDDING_MODEL`. Cambiarlo vuelve a indexar los transcripts con la nueva versión.
