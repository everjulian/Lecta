# ADR-003: Electron como shell desktop

- Estado: aceptado
- Fecha: 2026-08-07

## Decisión

Usar Electron con React en renderer y Node en main. Todo privilegio cruza un preload aislado y contratos IPC explícitos.

## Consecuencias

Electron ofrece acceso maduro a Windows y un stack TypeScript compartido, con mayor consumo de recursos. La superficie IPC requiere validación y revisión de seguridad continua.
