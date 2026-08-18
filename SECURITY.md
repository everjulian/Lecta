# Seguridad de Lecta

## Reportar una vulnerabilidad

No publiques vulnerabilidades, credenciales, grabaciones ni datos personales
en un issue público.

Reporta el problema de forma privada al propietario del repositorio mediante la
función **Private vulnerability reporting** de GitHub, si está habilitada. Si
esa opción no está disponible, contacta al mantenedor mediante un canal privado
visible en su perfil de GitHub y solicita un medio seguro para compartir los
detalles.

Incluye únicamente la información necesaria para reproducir el problema:

- versión o commit afectado;
- impacto observado;
- pasos mínimos de reproducción;
- mitigación conocida, si existe.

Elimina claves, tokens, audio real, transcripciones y demás información
sensible antes de adjuntar registros o capturas. El mantenedor confirmará la
recepción y coordinará la corrección y divulgación responsable.

## Alcance

Se consideran especialmente sensibles el aislamiento de Electron, los canales
IPC, la persistencia local, el acceso a archivos, la captura de audio y el
manejo de claves de proveedores externos.

Este documento no establece todavía una política formal de soporte por
versiones ni un plazo garantizado de respuesta.
