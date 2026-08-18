# Setup local

## Instalar

```bash
git clone https://github.com/everjulian/Lecta.git
cd Lecta
pnpm install --frozen-lockfile
```

## Ejecutar

```bash
pnpm dev
```

El modo productivo usa datos bajo `userData` de Electron. Los E2E crean un directorio temporal independiente y nunca tocan datos reales.

La captura loopback real requiere Windows. Transcripción requiere Python 3.11 o 3.12 y el comando `pnpm setup:transcription`.
