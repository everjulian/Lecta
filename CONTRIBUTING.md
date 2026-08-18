# Contribuir a Lecta

Gracias por contribuir a Lecta. Antes de comenzar, lee `AGENTS.md` y
`docs/architecture/ARCHITECTURE.md`.

## Preparación

Lecta requiere Node.js 22 o superior y pnpm. El repositorio fija la versión de
pnpm mediante `packageManager` en `package.json`.

```bash
corepack enable
pnpm install
```

Copia `.env.example` como `.env` solo cuando necesites configurar integraciones
locales. Nunca confirmes claves, tokens, credenciales, grabaciones, bases de
datos ni modelos descargados.

## Ramas

`main` contiene código estable. Crea ramas pequeñas desde `main` usando uno de
estos prefijos:

- `feat/` para funcionalidad nueva.
- `fix/` para correcciones.
- `refactor/` para cambios internos sin alterar comportamiento.
- `docs/` para documentación.
- `test/` para pruebas.

Ejemplos: `feat/export-transcript` y `fix/recording-recovery`.

## Arquitectura y calidad

Mantén la dirección de dependencias
`UI -> IPC -> Application -> ports <- Infrastructure`. React no accede a
SQLite, filesystem ni APIs de Node. La lógica del dominio permanece TypeScript
puro y los inputs se validan en el límite IPC.

Antes de proponer un cambio ejecuta:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

Añade pruebas para reglas importantes y evita introducir dependencias sin una
justificación concreta. Los cambios arquitectónicos significativos requieren
un ADR.

## Commits

Usamos Conventional Commits con asuntos breves en modo imperativo:

- `feat: add transcript export`
- `fix: preserve chunks after an unexpected shutdown`
- `refactor: isolate session query mapping`
- `test: cover invalid recording transitions`
- `docs: explain local model storage`
- `chore: configure repository metadata`

Separa cambios sin relación en commits diferentes. No incluyas archivos
generados ni reformatees código ajeno a la tarea.

## Pull requests

Describe el problema, la solución, los riesgos y las validaciones ejecutadas.
Mantén cada pull request enfocado y confirma que no expone datos locales o
secretos. No mezcles una reescritura amplia con una funcionalidad pequeña.
