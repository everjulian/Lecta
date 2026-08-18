# Repository Structure

```text
apps/
├── desktop/        Electron main, preload y React renderer
└── docs/           Configuración y shell Docusaurus
packages/
├── domain/         Entidades y reglas puras
├── application/    Casos de uso y puertos
├── infrastructure/ SQLite y filesystem
├── recording/
├── transcription/
├── ai/
└── shared/
workers/            Procesos pesados aislados
tests/              Pruebas transversales
docs/               Única fuente Markdown de documentación
```

`apps/docs` no contiene una segunda copia de contenido: el plugin de Docusaurus lee directamente el `/docs` raíz.
