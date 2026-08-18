# AI

`AIProvider` es el puerto para generación estructurada. El pipeline divide transcripciones largas, genera análisis parciales y sintetiza un resultado validado.

```text
Transcript → TranscriptChunker → AIProvider → StructuredNotes → SQLite
```

La API key solo existe en Electron main. Audio y transcripción nunca se reemplazan al regenerar apuntes. Consulta [ADR AI Notes](../adr/ADR-006-ai-notes.md).
