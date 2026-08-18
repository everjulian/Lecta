# Principios

1. **Local-first:** sesiones, audio, transcripciones e índices viven localmente por defecto.
2. **Audio primero:** grabar tiene prioridad sobre transcribir, indexar o generar IA.
3. **Artefactos independientes:** cada derivado puede regenerarse sin destruir su fuente.
4. **Dependencias hacia dentro:** UI e infraestructura dependen de aplicación y dominio, no al revés.
5. **Privacidad por diseño:** el renderer no recibe Node, rutas arbitrarias ni secretos.
6. **Errores recuperables:** la interfaz explica qué pasó y qué datos permanecen seguros.
7. **Evidencia antes de optimizar:** benchmarks reproducibles preceden a cambios de rendimiento.

Las reglas obligatorias para cambios están en `AGENTS.md` y la explicación completa en [Architecture](../architecture/ARCHITECTURE.md).
