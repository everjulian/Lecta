# Error and recovery model

## Boundary contract

Every asynchronous IPC handler returns one of these discriminated shapes:

```ts
{ success: true, data }
{ success: false, error: { code, userMessage, safeStateMessage, retryable, technicalDetailsId } }
```

Electron exceptions and stack traces stop in main. The preload validates the envelope and rejects renderer calls only with the plain, safe error DTO. UI decisions use `code` and `retryable`, never provider messages.

Stable codes are `RECORDING_DEVICE_UNAVAILABLE`, `RECORDING_FILE_MISSING`, `TRANSCRIPTION_FAILED`, `AI_UNAVAILABLE`, `KNOWLEDGE_INDEX_FAILED`, `DATABASE_BUSY`, `STORAGE_FULL`, and `UNKNOWN_ERROR`.

## Logging and privacy

`SafeStderrLogger` is the current adapter behind the existing `Logger` port. It emits JSON lines so a future file adapter can replace it in the composition root. The adapter accepts only diagnostic identifiers, operation, stable error code, error type, and operating-system code. It deliberately ignores exception messages and all unknown context keys.

API keys, tokens, transcript text, notes, prompts, audio, recording chunks, filesystem paths and stack traces are not logged by default. `technicalDetailsId` correlates the UI report with the safe technical event.

## Recovery matrix

| Failure                    | Safe state                                 | Recovery                                                                                  |
| -------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Incomplete recording       | Persisted chunks remain untouched          | Existing Recover/Discard flow; never automatic recording                                  |
| Interrupted transcription  | Audio and previous transcript remain       | Persisted job becomes interrupted/failed and can be restarted                             |
| Interrupted AI generation  | Audio and transcript remain                | Generate again; derived notes are replaced only after validation and save                 |
| Interrupted knowledge work | Sessions/transcripts remain read-only      | Worker failure is isolated; a later query restarts/reindexes                              |
| SQLite busy/locked         | Transaction semantics preserve stored data | Read-only IPC operations retry after 50 ms and 150 ms; writes require explicit user retry |
| Missing recording          | Session and derived artifacts remain       | Report non-retryable missing-file state; never delete session automatically               |
| Storage full               | Previously flushed data remains            | Ask user to free space; no blind retry loop                                               |

Retries are intentionally narrow. Device permission, storage-full, missing-file, writes, destructive operations and provider failures do not loop automatically. Their visible action is explicit and user-controlled.

## UI requirements

`ErrorNotice` always communicates what happened, what remains safe, whether the user can retry, and a technical reference. The recording state continues to be visible independently of the error. Failed transcription and AI states retain their existing explicit restart/generate actions.
