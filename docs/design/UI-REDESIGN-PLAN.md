# Lecta — UI Redesign Implementation Plan

Este plan implementa la dirección **Minimal / Calm / Productivity** seleccionada en `UX-UI-AUDIT.md`. Cada fase debe entregarse, probarse y poder revertirse independientemente. No cambia dominio, recording, transcription ni AI salvo contratos de presentación imprescindibles.

## Guardrails

- UX first; tokens second; components third; screens last.
- No reescritura completa ni CSS paralelo por pantalla.
- Un solo tema visual activo durante migración; dark llega cuando todos consuman semantic tokens.
- Capturas before/after y axe por fase visible.
- Mantener funcionalidades y contratos IPC existentes.

## Phase UI-0 — Baseline and Product States

### Objetivo

Congelar flujos, copys y estados antes del cambio visual.

### Trabajo

- Inventario Storybook-free mediante una ruta/harness de fixtures solo en test.
- Matriz `idle/recording/paused/processing/completed/failed/empty/error`.
- Baselines visuales de Home, modal, recorder, session, transcript, notes y Ask.
- Definir error presentation model y estados `saved/preparing/ready` sin cambiar servicios.

### Pruebas

- Playwright Electron abre cada fixture.
- Axe baseline documenta excepciones existentes.
- Sin cambios visuales productivos.

## Phase UI-1 — Design Tokens and Themes Architecture

### Objetivo

Centralizar decisiones sin alterar significativamente la apariencia.

### Trabajo

- `design-system/tokens/{primitives,semantic,typography,motion}.css`.
- `themes/light.css` con equivalentes actuales.
- Sustituir colores, spacing, radii, shadows y typography por tokens de forma mecánica.
- Añadir reduced motion global.

### Pruebas

- Visual diff bajo (&lt;1% esperado).
- Contrast checks de tokens semánticos.
- `format/lint/typecheck/build`.

## Phase UI-2 — Core Components

### Objetivo

Eliminar variaciones accidentales en controles repetidos.

### Trabajo

- Button, IconButton, Input, SearchInput, Select, Badge, Progress, EmptyState.
- Modal accesible y Tabs accesibles.
- Elegir una librería de iconos outlined, justificar dependencia y envolver solo tamaño/label.
- Migrar un componente a la vez; retirar clase CSS anterior al terminar cada migración.

### Pruebas

- Unit tests de variantes y loading.
- Keyboard: Tab/Shift+Tab/Enter/Space/Escape/flechas tabs.
- Axe por componente compuesto.
- Visual snapshots por variante, no por cada pantalla.

## Phase UI-3 — App Shell and Navigation

### Objetivo

Separar orientación global de estados contextuales.

### Trabajo

- Introducir navegación `Inicio / Biblioteca / Preguntar`; Settings al pie.
- Sidebar normal, rail compacto y header mínimo.
- Detalle de sesión conserva back navigation contextual.
- Recorder activa focus mode sin sidebar.
- No añadir command palette todavía.

### Pruebas

- Deep/open state por destino.
- Focus order y navegación solo teclado.
- Ventanas 720×520, 1100×720 y 1440×900.
- E2E existente de sesión no cambia.

## Phase UI-4 — Home and Library

### Objetivo

Optimizar antes de clase y encontrar sesiones sin dashboard.

### Trabajo

- Inicio: Nueva sesión, trabajo activo/reciente y lista corta.
- Biblioteca: search dominante, filtros progresivos y lista paginada.
- Mover formulario Ask fuera de Biblioteca.
- Modal Nueva sesión reduce campos; tags pasan a opciones avanzadas/edición posterior.
- Empty states específicos.

### Pruebas

- Crear/abrir sesión.
- Search, filtros, paginación y limpiar filtros.
- Screenshots vacía, poblada, filtrada y sin resultados.
- Latencia percibida: debounce no borra resultados prematuramente.

## Phase UI-5 — Recorder

### Objetivo

Máxima confianza con mínima distracción.

### Trabajo

- Focus mode con Grabando/Timer.
- Indicadores de micrófono y audio sistema basados en estado real, no decorativo.
- Pausar/Finalizar con jerarquía y confirmación solo si evita error real.
- Paused claramente distinto; recovery mantiene prioridad.
- Documentar mini recorder; no implementarlo en esta fase.

### Pruebas

- E2E con RecordingEngine fake para start/pause/resume/finish/error.
- Keyboard completo.
- Visual recording/paused/source missing.
- Reduced motion elimina pulse.

## Phase UI-6 — Post-session and Session View

### Objetivo

Cambiar de captura a comprensión sin exponer pipeline técnico.

### Trabajo

- Estado inmediato “Grabación guardada”.
- Timeline honesta `guardado/preparando/listo`; opciones técnicas bajo Advanced.
- Header compacto; Resumen protagonista.
- Tabs y mini player coherentes; fuentes/timestamps comparten patrón.
- Tareas se muestran como lista hasta tener persistencia o se implementa persistencia en tarea separada.

### Pruebas

- Estados saved/transcribing/notes/error/retry.
- Audio/timestamp abre el segundo correcto.
- Transcript largo conserva rendimiento y scroll.
- Visual Resumen, Apuntes, Transcript y Audio.

## Phase UI-7 — Ask Lecta

### Objetivo

Pregunta, respuesta y evidencia en una jerarquía inequívoca.

### Trabajo

- Destino propio con ejemplos iniciales y scope visible.
- Estado “Preparando biblioteca” separado de “Buscando evidencia”.
- Error presentation humano.
- Fuentes compactas con clase, fecha, timestamp, fragmento y abrir momento.
- No convertirlo en chat social ni añadir avatares/burbujas.

### Pruebas

- Respuesta con una/múltiples fuentes.
- Evidencia insuficiente.
- Timeout/offline/model preparation.
- Abrir fuente navega y reproduce.
- Axe y visual snapshots estables.

## Phase UI-8 — Settings

### Objetivo

Dar un lugar confiable a preferencias existentes.

### Trabajo

- Audio, procesamiento, IA, almacenamiento, apariencia y acerca de.
- Nunca mostrar API key completa; secret storage requiere ADR técnico separado.
- Tema `light/dark/system` solo cuando semantic tokens cubran 100%.
- Explicar privacidad y qué procesamiento puede salir del equipo.

### Pruebas

- Persistencia de preferencias.
- Theme sin flash y con contraste.
- Secret fields/accessibility.
- Settings no afecta una grabación activa sin confirmación.

## Phase UI-9 — Polish and Release Gate

### Objetivo

Eliminar inconsistencias y certificar el sistema.

### Trabajo

- Auditoría de iconos, copys, focus, hover, pressed, loading y success.
- Retirar estilos legacy y valores visuales hardcoded restantes.
- Optimizar responsive desktop y zoom 200%.
- Evaluar mini recorder con prototipo técnico separado.

### Release Gate

- Cero colores/radius/shadows directos fuera de tokens salvo media nativa documentada.
- Axe sin violaciones serias/críticas en flujos centrales.
- E2E crítico verde.
- Visual baselines revisados.
- Lint, typecheck, tests, build y format verdes.
- Revisión manual teclado y reduced motion.

## Suggested Delivery Order

```text
UI-0 -> UI-1 -> UI-2 -> UI-3
                    ├-> UI-4
                    ├-> UI-5
                    ├-> UI-6
                    └-> UI-7
UI-4..7 -> UI-8 -> UI-9
```

UI-5 puede desarrollarse en paralelo con UI-4 después de UI-2/3 porque sus superficies son independientes. UI-8 espera cobertura completa de tokens. Cada PR debe limitarse a una fase o componente migrado y no mezclar cambios de dominio.
