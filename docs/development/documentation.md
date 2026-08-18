# Documentation development

## Fuente de verdad

Todo contenido vive en `/docs`. El sitio `apps/docs` consume ese directorio con `path: '../../docs'`; no copies páginas hacia la aplicación Docusaurus.

## Flujo

```bash
pnpm docs:dev
pnpm docs:build
```

La sidebar es manual en `apps/docs/sidebars.js`. Añade solo páginas que aporten navegación clara y evita generar cientos de entradas.

## Versioning

No se crea una versión por commit. Se congelará documentación únicamente para releases relevantes, inicialmente `v0.1`, `v0.2` y `v1.0`. Antes de versionar deben existir una release de producto y una política de mantenimiento definida.

## Despliegue

El proyecto está preparado para GitHub Pages mediante URL/base path configurables, `trailingSlash: false` y `.nojekyll`. No existe workflow de deploy automático hasta confirmar la URL pública final. La configuración requerida sigue las recomendaciones oficiales de [Docusaurus Deployment](https://docusaurus.io/docs/deployment).
