# ADR-001: Arquitectura por capas y puertos

- Estado: aceptado
- Fecha: 2026-08-07

## Decisión

Separar dominio, aplicación, infraestructura y adaptadores de entrada. Los puertos de repositorio viven en aplicación y las implementaciones técnicas dependen de ellos.

## Consecuencias

Las reglas pueden probarse sin Electron o SQLite y las integraciones son reemplazables. A cambio, existen más interfaces y wiring que en una aplicación organizada solo por pantallas.
