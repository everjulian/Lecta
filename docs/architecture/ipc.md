# IPC

El flujo permitido es `Renderer → Preload → IPC → Application`. Los canales e inputs están definidos en contratos compartidos y cada handler valida datos desconocidos en main.

Los resultados usan una unión discriminada:

```ts
{ success: true, data }
{ success: false, error: { code, userMessage, safeStateMessage, retryable, technicalDetailsId } }
```

El preload desempaqueta el resultado y nunca entrega stacks al renderer. La política completa está en [Error and recovery model](./ERRORS-AND-RECOVERY.md).
