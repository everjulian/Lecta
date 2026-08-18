# Security quality

La calidad de seguridad se revisa en cuatro límites:

- Electron: aislamiento, sandbox y navegación restringida.
- IPC: canales mínimos, validación y resultados saneados.
- Datos: repositorios y filesystem fuera del renderer.
- Credenciales/logs: secretos solo en main y metadata allowlisted.

La política de reporte está en `SECURITY.md`. La estrategia de errores se documenta en [Error and recovery model](../architecture/ERRORS-AND-RECOVERY.md).
