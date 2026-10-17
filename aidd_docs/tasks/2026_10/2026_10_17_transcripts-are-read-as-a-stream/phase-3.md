---
status: done
---

# Instruction: Memory measured, docs, gates

## Steps

1. Bench: a generated transcript of a few hundred MB in the scratchpad, `ReadUsageUseCase` with the real adapter in a child process, peak RSS before (`origin/next`) and after. Delete the file.
2. `aidd_docs/product/usage-contract.md` residual limits, `cli/aidd_docs/memory/telemetry.md`: what memory a read takes now.
3. Gates, one heavy run at a time; mutation under the lock. See [`evidence.md`](./evidence.md).
