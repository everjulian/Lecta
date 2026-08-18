# Lecta — Product Design & UX/UI Audit

- Fecha: 2026-08-13
- Alcance: experiencia y sistema visual actuales; no incluye implementación del rediseño
- Evidencia: componentes React, CSS, contratos/estados de producto y capturas de Home, sesión, transcript, notas y Ask aportadas durante el desarrollo
- Limitación: no existe Settings ni onboarding implementado; se evalúan como ausencias, no como pantallas reales. No fue posible ejecutar automatización interactiva Windows en este entorno.

## 1. Current State

Lecta tiene una identidad inicial coherente: fondo cálido, verde sobrio, espacios generosos y una acción principal reconocible. La experiencia comprende dos vistas principales sin router: Biblioteca/Home y detalle de sesión. Nueva sesión aparece como modal. Ask Lecta está incrustado en Home; el detalle cambia según la máquina de estados y contiene materiales en tabs.

```text
Biblioteca/Home
  ├─ Nueva sesión (modal)
  ├─ Ask Lecta
  ├─ búsqueda + filtros
  ├─ recientes + listado
  └─ abrir sesión
       ├─ idle -> grabar
       ├─ recording -> pausar/finalizar
       ├─ paused -> reanudar/finalizar
       └─ completed -> Resumen | Apuntes | Transcripción | Audio
```

No hay navegación global, onboarding, Settings, centro de actividad ni estado unificado “Guardado → Procesando → Listo”. La UI revela conceptos técnicos como modelo `small/medium`, “modo ligero” y mensajes IPC crudos.

### Recorrido de flujos

| Flujo             | Objetivo                       |                          Pasos actuales | Fricción / información faltante                                                                               |
| ----------------- | ------------------------------ | --------------------------------------: | ------------------------------------------------------------------------------------------------------------- |
| Onboarding        | Entender valor y comenzar      |                               No existe | No explica privacidad local, permisos, audio del sistema o primera grabación                                  |
| Home              | Orientarse y continuar         |                                     0–1 | “Biblioteca” actúa como Home; Ask, filtros, recientes y lista compiten verticalmente                          |
| Crear sesión      | Preparar contexto              |                      1 modal + 4 campos | Tags son taxonomía avanzada prematura; falta anticipar fuentes de audio antes de crear                        |
| Iniciar grabación | Grabar rápido                  | Crear/abrir → elegir micrófono → Grabar | Correcto, pero estado de audio del sistema no es visible antes de iniciar                                     |
| Durante           | Confirmar captura              |                                       0 | Timer/estado son claros; faltan indicadores explícitos de micrófono y sistema                                 |
| Pausar            | Detener temporalmente          |                                       1 | Estado comprensible; debe evitar confundir Pausar con Finalizar                                               |
| Finalizar         | Guardar con seguridad          |                                       1 | No existe confirmación contextual; salto a “completada” no narra qué sigue                                    |
| Transcribir       | Obtener texto                  |  Elegir modelo + recursos → Transcribir | Obliga a entender implementación; debería ofrecer una opción recomendada simple                               |
| Procesar notas    | Obtener valor                  |                         Generar apuntes | “Transcripción” y “IA” se sienten como tareas separadas del usuario, no pipeline del producto                 |
| Leer transcript   | Verificar contenido            |                       Tab Transcripción | Timestamps son útiles; lista larga carece de búsqueda interna/virtualización visual                           |
| Leer notas        | Comprender la sesión           |                    Tabs Resumen/Apuntes | Buen agrupamiento, pero demasiadas secciones compiten y tareas parecen persistentes aunque checklist es local |
| Buscar            | Encontrar sesión               |                           texto/filtros | Cobertura potente; controles ocupan mucha altura y fechas tienen precisión innecesaria por defecto            |
| Ask Lecta         | Preguntar al conocimiento      |           pregunta → respuesta → fuente | Modelo correcto; ocupa el primer bloque de Library y desplaza sesiones. Errores técnicos rompen confianza     |
| Settings          | Configurar audio/IA/apariencia |                               No existe | Preferencias quedan en `.env` o implícitas; no hay lugar mental para modelo, privacidad o tema                |

## 2. UX Problems

### P0

1. **Los errores técnicos llegan al usuario.** “Error invoking remote method…” no explica qué pasó ni qué hacer. Daña la percepción premium y la confianza.
2. **Durante grabación no se confirma cada fuente.** “Grabando” no demuestra si micrófono y audio del sistema están activos. Es el momento de mayor riesgo percibido.
3. **El pipeline pos-sesión exige conocimiento técnico.** Modelo Whisper/recursos/proveedor compiten con el resultado que busca el usuario.

### P1

1. Home mezcla Home, Library y Ask en una sola página larga.
2. No existe navegación persistente ni una ubicación para Settings.
3. No existe una progresión única “Grabación guardada → Transcribiendo → Preparando apuntes → Lista”.
4. El modal incluye tags antes de que el usuario haya construido una organización propia.
5. Ask no ofrece preguntas de ejemplo, contexto del alcance ni estado de preparación del índice local.

### P2

1. Filtros siempre visibles generan densidad antes de ser necesarios.
2. Las cards recientes duplican información del listado y pueden hacer Home más dashboard.
3. La jerarquía del detalle completado mantiene demasiado protagonismo en el timer y orb, aunque el objetivo ya cambió a comprender.
4. Los tabs no caben conceptualmente en ventanas pequeñas sin estrategia de overflow.
5. Tareas muestran checkboxes que no se persisten; la affordance promete más que la funcionalidad.

### P3

1. Copys mezclan sesión, clase y reunión sin adaptar siempre el contexto.
2. Iconos son caracteres Unicode (`←`, `⌕`, `▶`, `×`, `›`) con estilos visuales diferentes.
3. Menú nativo Electron visible aporta ruido y no contiene acciones específicas de Lecta.

## 3. UX Strengths

- Una acción primaria por estado en la mayoría de pantallas.
- Grabación explícita: nunca comienza automáticamente.
- Timer grande y señal roja legible durante captura.
- Recuperación de grabaciones incompletas ofrece Recuperar/Descartar.
- El transcript conserva timestamps y permite reproducir desde evidencia.
- Ask coloca fuentes locales debajo de la respuesta, una decisión de confianza correcta.
- La paleta evita neón, gradientes “AI” y glassmorphism.
- Espacios y contenido máximo crean una sensación calmada.
- Los estados vacíos actuales explican un siguiente paso básico.

## 4. Information Architecture

### Comparación

La estructura conceptual `Home / Library / Ask Lecta / Settings` es válida, pero cuatro destinos permanentes son excesivos si Home solo repite Library. La mejor estructura para Lecta es:

```text
Inicio
  propósito: antes de una clase
  Nueva sesión + continuar/revisar reciente + actividad de procesamiento

Biblioteca
  propósito: encontrar
  búsqueda, filtros, materias/proyectos, sesiones

Preguntar
  propósito: sintetizar conocimiento
  pregunta, alcance, respuesta, evidencia, historial futuro

Settings (acción secundaria al pie)
  audio, procesamiento local, IA, almacenamiento, apariencia

Detalle de sesión (contextual, no destino principal)
Grabador (modo de enfoque, no destino principal)
```

En ventana normal, una sidebar discreta de 216–232 px mejora orientación. En ventana pequeña se colapsa a rail de 56–64 px o a header compacto. Durante recording, la sidebar desaparece para reducir distracción. No se recomienda un dashboard con métricas.

## 5. Heuristic Evaluation

| Issue                          | Screen       | Severity | Evidence                                      | Recommendation                                                    |
| ------------------------------ | ------------ | -------- | --------------------------------------------- | ----------------------------------------------------------------- |
| Estado de fuente no visible    | Recording    | 4/4      | Solo timer/estado; no mic/system              | Dos indicadores compactos con estado y nombre de micrófono        |
| Error interno sin recuperación | Ask/AI       | 4/4      | Mensaje IPC completo en banner                | Copy humano + acción Reintentar/Configurar/Ver detalle opcional   |
| Pipeline técnico               | Post session | 3/4      | Modelo y recursos expuestos                   | “Transcribir” recomendado; opciones avanzadas colapsadas          |
| Ubicación ambigua              | Home         | 3/4      | Título Biblioteca, pero incluye Ask/recientes | Separar Inicio, Biblioteca y Preguntar                            |
| Falta control durante AI       | Notes/Ask    | 3/4      | Sin cancelación/reanudación visible           | Estado persistente y navegación libre; cancelación cuando aplique |
| Tags prematuros                | New Session  | 2/4      | Campo siempre visible                         | Mover a “Más opciones” o edición posterior                        |
| Filtros densos                 | Library      | 2/4      | Cinco controles simultáneos                   | Search dominante; filtros en popover/chips activos                |
| Checklist no persistente       | Notes        | 3/4      | Checkbox parece guardar                       | Persistir estado o renderizar como lista hasta hacerlo            |
| Tabs semánticamente débiles    | Session      | 2/4      | Apariencia de segmented control               | Tablist accesible, focus/arrow keys y overflow                    |
| Sin ayuda contextual           | First use    | 3/4      | No onboarding                                 | Empty state guiado de una pantalla, no tour largo                 |
| Settings ausente               | Global       | 3/4      | Configuración fuera de UI                     | Destino secundario estable                                        |
| Modal incompleto               | New Session  | 2/4      | Escape existe; sin focus trap/restore         | Componente Modal accesible central                                |

Escala: 1 cosmético, 2 fricción menor, 3 problema importante, 4 bloquea confianza/objetivo.

## 6. Visual Problems

### Jerarquía

- **Home actual:** primero se ve “Biblioteca”, después Nueva sesión y luego Ask. Para antes de clase debería verse primero Nueva sesión/continuar, no Ask global.
- **Recording:** timer domina correctamente. La identidad completa y orb ocupan demasiado espacio; dos indicadores de fuente aportarían más valor.
- **Completed:** timer/orb conservan jerarquía de un estado ya terminado. El resumen debe tomar el primer plano.
- **Ask:** el contenedor verde claro es muy grande; pregunta y respuesta deberían tener más relación vertical. Las fuentes deben ser claramente secundarias, no cards equivalentes.

### Sistema inconsistente

- Hoja CSS de ~965 líneas y cerca de 80 valores hex.
- Radios de 7, 9, 10, 11, 12, 14, 15, 16, 18 y 20 px.
- Tamaños tipográficos y espaciados ad hoc.
- Sombras y opacidades expresadas directamente por componente.
- Unicode usado como iconografía sin una familia consistente.
- Un solo breakpoint principal; filtros/sidebar/tabs no tienen estrategia completa.

### Qué puede desaparecer

- Orb grande una vez completada la sesión.
- Opciones de modelo/recursos del camino principal.
- Tags en creación básica.
- Filtros avanzados siempre abiertos.
- Botón “Mostrar archivo” como acción primaria; debe vivir en menú secundario.
- Mensajes internos del pipeline y del proveedor.

## 7. Design Principles

1. **Capture first.** Antes de la clase, grabar debe requerir la menor deliberación posible.
2. **Quiet confidence.** Durante, mostrar evidencia de que funciona y nada más.
3. **Results, not pipeline.** Después, hablar de Guardado/Preparando/Listo, no de Whisper o adapters.
4. **Evidence is a feature.** Cada insight de IA debe poder rastrearse al momento original.
5. **Progressive disclosure.** Opciones técnicas y filtros avanzados aparecen solo cuando se piden.
6. **Personal knowledge, not enterprise analytics.** No métricas, KPIs ni grids de widgets.
7. **Local-first made visible.** Comunicar privacidad con lenguaje sobrio, no con banners constantes.
8. **Keyboard complete.** Cada acción tiene foco, orden y alternativa de teclado.

## 8. Design Direction

### Direction A — Minimal / Calm / Productivity

- **Typography:** system UI/Segoe UI Variable; display sobrio, body muy legible.
- **Colors:** neutros cálidos, tinta verde-negra y un único verde profundo; rojo reservado a recording/danger.
- **Density:** aireada en Inicio/resultado; compacta en listas.
- **Navigation:** sidebar tenue y contenido dominante; recorder sin shell.
- **Components:** superficies planas, bordes sutiles, pocas sombras.
- **Strengths:** coherente con privacidad, estudio y sesiones largas; menor deuda desde diseño actual.
- **Risks:** puede sentirse demasiado austera si faltan detalles tipográficos/microinteracciones.

### Direction B — Knowledge Workspace

- **Typography:** sans humanista + jerarquía editorial marcada.
- **Colors:** papel cálido, superficies de documento, acentos por materia.
- **Density:** media; sidebar/folders, contenido tipo documento y panel contextual Ask.
- **Navigation:** Biblioteca como árbol de materias/proyectos; Ask contextual por scope.
- **Components:** editor/document, citation blocks, outline y metadata.
- **Strengths:** excelente para leer, organizar y conectar conocimiento a largo plazo.
- **Risks:** deriva hacia Notion; más compleja antes de validar organización profunda.

### Direction C — Modern Desktop Native

- **Typography:** Segoe UI Variable; controles compactos y métricas Windows.
- **Colors:** sigue tema del sistema; mayor uso de menús/context menus.
- **Density:** compacta y eficiente.
- **Navigation:** command palette, atajos, rail adaptable y mini recorder potencial.
- **Components:** toolbar, split panes, menu, tooltip y shortcuts.
- **Strengths:** rápida, familiar y escalable para power users.
- **Risks:** puede perder calidez/personalidad y aumentar complejidad de Electron/Windows.

### Selección

**Direction A**, incorporando selectivamente comportamiento nativo de C. Lecta necesita confianza silenciosa más que un workspace complejo. La base visual actual ya está cerca; permite migración incremental mediante tokens, reduce riesgo y deja espacio para que contenido y evidencia sean protagonistas. La sidebar y shortcuts pueden evolucionar sin adoptar densidad de herramienta empresarial.

## 9. Visual Research: Useful Patterns vs Surface Trends

Patrones útiles:

- Linear enfatiza consistencia de headers/navegación, sidebar tenue y contenido dominante; también combina mouse con shortcuts descubribles.
- Arc usa sidebar colapsable y espacios para contexto, pero Lecta no necesita espacios múltiples todavía.
- Granola estructura el producto alrededor de antes/durante/después y permite verificar notas contra citas exactas; es especialmente relevante para Lecta.
- Raycast demuestra que una interfaz de comando sirve para usuarios recurrentes, pero no debe reemplazar acciones visibles para principiantes.
- Notion/Craft/Apple Notes validan jerarquía editorial y lectura centrada; no justifican convertir cada sesión en un editor complejo.

Tendencias a evitar:

- gradientes morado/azul para señalar IA;
- globos de chat como interfaz universal;
- glass/blur en superficies principales;
- tarjetas para cada dato;
- sidebar con demasiadas taxonomías antes de tener contenido;
- animaciones de “pensamiento” sin información real.

Referencias oficiales:

- Linear UI: https://linear.app/changelog/2026-03-12-ui-refresh
- Linear contextual interaction: https://linear.app/now/invisible-details
- Arc focus/sidebar: https://start.arc.net/find-focus
- Granola before/during/after: https://www.granola.ai/
- Granola evidence and notes: https://www.granola.ai/blog/announcement
- Granola contextual chat: https://docs.granola.ai/help-center/getting-more-from-your-notes/chatting-with-your-meetings

## 10. Design Tokens Proposal

```text
design-system/
  tokens/
    primitives.css
    semantic.css
    typography.css
    motion.css
  themes/
    light.css
    dark.css
  components/
  icons/
```

### Primitive tokens

```css
/* spacing */
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-6: 24px;
--space-8: 32px;
--space-12: 48px;
--space-16: 64px;

/* radius: máximo 4 */
--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 16px;
--radius-round: 999px;

/* typography */
--text-display: 48px/1.05;
--text-heading-lg: 32px/1.15;
--text-heading-md: 20px/1.3;
--text-body: 15px/1.6;
--text-body-sm: 13px/1.5;
--text-caption: 11px/1.4;

/* motion */
--duration-fast: 100ms;
--duration-normal: 160ms;
--ease-standard: cubic-bezier(0.2, 0.8, 0.2, 1);
```

### Semantic tokens

```css
--background-primary;
--background-secondary;
--surface;
--surface-hover;
--text-primary;
--text-secondary;
--text-muted;
--border;
--border-subtle;
--accent;
--accent-hover;
--success;
--warning;
--danger;
--recording;
--focus-ring;
--shadow-raised;
```

Los componentes solo consumen tokens semánticos. Light/Dark asignan valores; cambiar accent requiere una sola edición. Usar `prefers-color-scheme` y permitir `light | dark | system` en Settings futuro.

## 11. Component System

### Núcleo UI-2

- Button (`primary`, `secondary`, `danger`, `ghost`; loading).
- IconButton con tooltip obligatorio.
- Input y SearchInput.
- Select.
- Modal con focus trap, Escape y restore.
- Badge/status.
- Progress con label real.
- EmptyState.
- Tabs accesibles.
- Toast/error notice.
- Icon wrapper sobre **una** librería outlined de trazo coherente.

### Después, solo cuando exista caso real

- Sidebar, Dropdown/Menu y Tooltip.
- Card/ListItem para recientes y biblioteca.
- Textarea si notas editables llegan al producto.

No crear inicialmente componentes genéricos de layout, “Box”, “Stack” o abstracciones de una sola aparición.

## 12. Screen-by-screen Recommendations

### Onboarding — P1

Una pantalla, no carrusel: “Lecta guarda tus sesiones localmente”; seleccionar micrófono; comprobar audio del sistema; CTA “Crear primera sesión”. Permisos se solicitan en contexto al grabar.

### Inicio — P1

Primero “Nueva sesión”. Segundo: sesión activa/procesando o último resultado. Tercero: 3–5 sesiones recientes en lista, no cuatro widgets. Ask aparece como acceso, no formulario completo.

### Nueva sesión — P1

Título, tipo y materia/proyecto. Tags bajo “Más opciones” o posteriores. Recordar últimos valores puede reducir fricción. Copy: “Crear y revisar audio”, no prometer grabación inmediata.

### Recording — P0

Mostrar `● Grabando`, timer, `Micrófono · [nombre] ✓`, `Audio del sistema ✓`, Pausar y Finalizar. Ocultar navegación, materia extensa, transcript y pipeline. `Pausado` usa ámbar, nunca animación roja. Mini Recorder se evalúa después de validar window lifecycle/always-on-top/accessibilidad.

### Post session — P0/P1

Transición inmediata: `Grabación guardada ✓`. Debajo una sola timeline de procesamiento: “Preparando transcripción” y “Creando material”. Opciones avanzadas colapsadas. Cuando esté listo, Resumen es default; timer/orb dejan de dominar.

### Session detail — P1

Header compacto con título, fecha, materia y menú secundario. Tabs debajo. Resumen general primero; conceptos/tareas/preguntas con secciones editoriales, no un grid de cards. Audio accesible persistentemente mediante mini player inferior si se verifica una cita.

### Library — P1

SearchInput dominante. Botón Filtros abre popover; filtros activos son chips removibles. Lista densa y escaneable con título, materia, fecha, duración y estado. Clases/reuniones recientes pertenecen a Inicio, no duplicadas aquí.

### Ask Lecta — P1

Destino propio. Pregunta centrada en estado vacío con tres ejemplos. Tras respuesta, texto domina; fuentes en lista compacta con clase/fecha/timestamp y fragmento expandible. Mostrar scope: “Toda tu biblioteca”. “No suficiente” sugiere reformular o buscar texto.

### Settings — P1

Audio, Procesamiento local, IA, Almacenamiento, Apariencia y Acerca de. No implementar integraciones o perfiles inexistentes. Mostrar claramente qué datos salen del equipo.

## 13. Empty, Loading and Error States

| Estado                 | Mensaje                                                                  | Acción                                |
| ---------------------- | ------------------------------------------------------------------------ | ------------------------------------- |
| Sin sesiones           | “Tu biblioteca empieza con una conversación.”                            | Nueva sesión                          |
| Sin transcript         | “La grabación está segura. Aún no tiene transcripción.”                  | Transcribir                           |
| Sin resultados         | “No encontramos esa idea en estos filtros.”                              | Limpiar filtros / Buscar en contenido |
| Sin notas              | “Ya tienes la transcripción. Puedes convertirla en apuntes.”             | Generar apuntes                       |
| IA sin conexión/config | “No pudimos preparar los apuntes. Tu audio y transcript siguen seguros.” | Reintentar / Configurar               |
| Sin micrófono          | “No encontramos un micrófono disponible.”                                | Revisar dispositivos                  |
| Sin audio sistema      | “Lecta no recibe el audio del sistema.”                                  | Volver a comprobar                    |
| Indexando conocimiento | “Preparando tu biblioteca para preguntas…”                               | progreso real o indeterminado honesto |

Nunca mostrar porcentajes derivados de etapas si no representan trabajo medido. El usuario puede navegar mientras procesa.

## 14. Microinteractions

- Hover/focus/pressed: 100–160 ms; no mover layout.
- Recording pulse: opacidad/halo discreto, 1.6–2 s; desactivar con reduced motion.
- Success: check aparece una vez, sin confeti.
- Loading button: conserva ancho y reemplaza label con estado.
- Toast: solo para resultados secundarios; errores críticos permanecen cerca de la acción.
- Tabs/listas: transición de color, no slide decorativo.

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms;
    transition-duration: 0.01ms;
  }
}
```

## 15. Accessibility

- WCAG AA para texto/controles; recording no depende solo de rojo.
- Focus visible consistente y orden lógico; sidebar → header → contenido.
- Tabs con flechas, Home/End y `aria-selected`.
- Modal con trap, Escape y retorno de foco.
- Progreso con `aria-live=polite`; errores con `role=alert` sin robar foco.
- Icon buttons con accessible name y tooltips no esenciales.
- Timer no debe anunciar cada actualización; texto de estado separado.
- Áreas click/touch mínimas 32×32 desktop, preferencia 36–40.
- Zoom 200% sin pérdida de acciones.
- Reduced motion y contraste alto considerados desde tokens.

## 16. Responsive Desktop

| Ventana         | Comportamiento                                                          |
| --------------- | ----------------------------------------------------------------------- |
| Mínima 720×520  | rail/header compacto; una columna; filtros en popover; tabs scrollables |
| Normal 1100×720 | sidebar 224 px; contenido 760–900 px; lectura 680–760 px                |
| Grande ≥1440    | sidebar fija; contenido no se estira; whitespace contextual             |

Evitar `min-width: 680px` como única estrategia. Cada vista posee scroll principal único; no mezclar scroll de ventana con paneles salvo transcript largo. Recorder centra contenido y mantiene acciones visibles verticalmente.

## 17. Priority Roadmap

### P0 — Confianza del flujo central

- Estados de micrófono/sistema durante recording.
- Error language humano y recuperable.
- Pipeline pos-sesión simplificado.

### P1 — Estructura y fundaciones

- Tokens/theme, componentes core y app shell.
- Inicio/Biblioteca/Preguntar/Settings.
- Session detail orientado a resultado.
- Onboarding mínimo y accesibilidad base.

### P2 — Eficiencia

- Filtros progresivos, shortcuts/command access y mini player.
- Persistencia real de tareas.
- Estados de procesamiento navegables.

### P3 — Polish

- Dark theme, microinteracciones completas, mini recorder evaluado.
- Personalización visual limitada y densidad configurable solo si hay demanda.
