# AGENTS.md — reglas para trabajar en Lecta

## Arquitectura

- Lee `docs/architecture/ARCHITECTURE.md` antes de modificar código.
- Conserva la dirección `UI -> IPC -> Application -> ports <- Infrastructure`.
- El dominio debe permanecer TypeScript puro, sin Electron, React, SQLite, filesystem ni APIs externas.
- `apps/desktop/main/container.ts` es el composition root.

## Reglas obligatorias

1. No mezclar UI con reglas de negocio.
2. No acceder a SQLite desde React.
3. No acceder directamente al filesystem desde React.
4. No introducir dependencias nuevas sin justificarlo.
5. Mantener TypeScript `strict` y no usar `any` ni `@ts-ignore`.
6. Escribir tests para lógica importante y reglas de dominio.
7. No romper funcionalidades existentes ni reescribir módulos completos sin necesidad.
8. Ejecutar lint, typecheck y tests antes de terminar una tarea.
9. Validar todo input en el límite IPC y exponer solo APIs mínimas por `contextBridge`.
10. Usar `DomainError`, `ApplicationError` e `InfrastructureError`; nunca ocultar errores.
11. Inyectar `Logger`; no dispersar `console.log` por el código.

## Convenciones

- Nombres de clases/casos de uso en PascalCase; archivos en kebab-case.
- Puertos pequeños y orientados a capacidad.
- Inmutabilidad hacia consumidores mediante `readonly` cuando aplique.
- Composition roots crean dependencias; evitar singletons globales fuera de ellos.
- Cambios arquitectónicos significativos requieren un ADR.

## Comandos

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
```

## No hacer

- No implementar transcripción o IA dentro del dominio, renderer o ruta crítica de grabación.
- No acumular grabaciones completas en memoria; persistir chunks incrementalmente.
- No ejecutar Whisper, IA ni procesamiento pesado mientras `RecordingEngine` esté activo.
- Toda transcripción debe ejecutarse mediante `TranscriptionProvider` fuera de renderer y fuera del proceso Electron main.
- Mantener un máximo de un job pesado activo hasta que un ADR cambie explícitamente el límite.
- No importar adapters de infraestructura desde dominio o aplicación.
- No exponer Node, `ipcRenderer`, SQLite o rutas arbitrarias al renderer.
- No agregar abstracciones especulativas sin un caso de uso concreto.
