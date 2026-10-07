---
status: done
---

# OpenCode contract
Both plugins export default `id/server/setup` (V1 >= 1.18.29; V2). V1 returns after `server`, without invoking named factories again. A dependency-free CLI-owned adapter lives at `.opencode/hooks/opencode-events.js`, outside plugin discovery; payload mapping stays plugin-specific.

Translation emits the helper once; setup tracks tool ownership; restoration includes it. Plugin install/update backfill missing helpers without replacing existing configuration, existing helper contents or recorded ownership/drift hashes. Source retrieval reuses one loader.

V2 setup subscribes with cancellable cleanup. Its `data/location` events correlate tool input and success by session/message/tool identity. Success consumes pending state; failures and terminal events discard it. Completion closes the turn; shutdown interruption leaves it resumable.

## Acceptance
- Import spawns no hooks.
- V1 invokes once; V2 setup returns promptly and cleanup aborts its stream.
- Malformed events, failed tools and repeated success are safe.
- Coding and architecture gates pass.
- Real V2 loads both plugins and updates memory/journal.
- Real V1 preserves effects without duplicate start.
- Verification distinguishes real-host effects from controlled regressions and substituted inference.
