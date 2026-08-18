# Accesibilidad en Lecta

## Quality gate

La suite Electron ejecuta `@axe-core/playwright` sobre los flujos centrales. El gate falla ante cualquier violación `serious` o `critical`; no se desactivan reglas de axe. Se usa `setLegacyMode(true)` únicamente porque el modo multipágina interno de axe intenta crear una página adicional que Electron Playwright no soporta. Esto cambia el mecanismo de inyección, no las reglas evaluadas.

Superficies cubiertas:

- Home y Biblioteca, vacía y con resultados/filtros.
- New Session Modal.
- Recorder en grabación y pausa.
- Session Completed y materiales.
- Ask con respuesta, fuentes y errores.
- Progress y errores de transcripción/IA mediante los flujos E2E existentes.
- Settings: pendiente; la pantalla todavía no existe y no se crea solo para esta validación.

El comando local es:

```bash
pnpm test:e2e
```

CI ejecuta la misma suite offline y conserva screenshots/traces solo cuando falla.

## Teclado y foco

- Todos los controles nativos responden a `Tab`, `Shift+Tab`, `Enter` y `Space` según su semántica.
- `Escape` cierra New Session Modal.
- El modal coloca el foco en Título, contiene el foco entre sus controles y lo devuelve al botón que lo abrió.
- Las pestañas de materiales implementan selección automática con `ArrowLeft`, `ArrowRight`, `Home` y `End`, incluyendo recorrido circular.
- `:focus-visible` usa un contorno de alto contraste en botones, icon buttons, inputs, selects y elementos con `tabindex`.
- El orden de foco sigue el orden del documento; no se usan valores positivos de `tabindex`.

## Semántica y anuncios

- Los icon buttons tienen nombre accesible; el cierre del modal se anuncia como “Cerrar”.
- Inputs, búsqueda y selects tienen labels visibles o nombres accesibles explícitos.
- Tabs exponen `tablist`, `tab`, `aria-selected`, `aria-controls` y `tabpanel`.
- Progresos de transcripción e IA usan `<progress>` con nombre accesible y una región `aria-live="polite"`.
- Estados de grabación usan texto visible “Grabando” y “Pausado”, además del indicador visual.
- Errores recuperables usan `role="alert"`.
- El timer visible usa `aria-hidden="true"`: el estado se anuncia, pero el contador no interrumpe al lector de pantalla cada segundo.
- No hay componente Toast actualmente; cuando exista deberá usar `status` para confirmaciones y `alert` solo para errores urgentes.

## Movimiento y zoom

`prefers-reduced-motion: reduce` elimina en la práctica animaciones y transiciones decorativas. La suite verifica esa preferencia.

El reflow equivalente a zoom 200 % se valida con un viewport CSS de 550 px —la mitad de la ventana Electron base de 1100 px— y sin scroll horizontal en Home. Los layouts pasan a una columna y las pestañas permiten desplazamiento horizontal local si el contenido lo requiere.

## Lista manual básica

Antes de cambios visuales significativos:

1. Recorrer Home → modal → recorder → completed → Library → Ask solo con teclado.
2. Confirmar que el foco nunca queda oculto ni sale del modal.
3. Confirmar que grabación y pausa se comprenden sin distinguir colores.
4. Probar lector de pantalla en estados, progreso y errores, verificando que el timer permanece silencioso.
5. Probar zoom 200 % y movimiento reducido en Windows.
6. Ejecutar `pnpm test:e2e` y revisar cualquier evidencia axe antes de fusionar.
