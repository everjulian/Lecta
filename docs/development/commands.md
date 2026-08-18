# Commands

| Comando                      | Uso                                    |
| ---------------------------- | -------------------------------------- |
| `pnpm dev`                   | Compilar y abrir Lecta                 |
| `pnpm build`                 | Build renderer, main, preload y worker |
| `pnpm lint`                  | Reglas ESLint                          |
| `pnpm typecheck`             | TypeScript strict                      |
| `pnpm test`                  | Unitarias e integración                |
| `pnpm test:e2e`              | Build y Playwright Electron            |
| `pnpm format:check`          | Verificar Prettier                     |
| `pnpm benchmark:performance` | Regenerar baseline                     |
| `pnpm docs:dev`              | Servidor Docusaurus                    |
| `pnpm docs:build`            | Build y enlaces de documentación       |

En CI se instala siempre con `--frozen-lockfile`.
