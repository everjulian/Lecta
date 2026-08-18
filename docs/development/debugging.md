# Debugging

1. Reproduce con datos temporales cuando sea posible.
2. Revisa el `technicalDetailsId` mostrado por la UI y los eventos saneados de main.
3. Ejecuta la prueba más pequeña relacionada antes de la suite completa.
4. Para E2E fallidos abre el trace y screenshot guardados por Playwright.
5. Para workers confirma lifecycle, timeout, cancelación y limpieza de procesos.

No añadas `console.log` dispersos ni registres audio, transcripciones, prompts, API keys o rutas sensibles. Consulta [Error and recovery model](../architecture/ERRORS-AND-RECOVERY.md).
