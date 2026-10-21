---
status: done
---

# Instruction: The key rule (M10)

```txt
cli/src/contexts/telemetry/domain/
├── formats/claude-transcript-usage.ts     ✏️ requestless key message.id:sessionId
└── legacy/legacy-usage-key.ts             🆕 an earlier requestless key, re-keyed
```

| Case | Proof |
| --- | --- |
| two copies of a requestless call at two timestamps: one key | format unit test |
| an earlier key re-keyed, advisor suffix kept, a `requestId` key untouched, re-keying twice = once | unit |
