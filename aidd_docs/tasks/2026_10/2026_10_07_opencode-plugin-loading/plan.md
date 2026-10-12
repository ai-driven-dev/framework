---
status: implemented
---

# Plan — OpenCode plugin loading
Load context and telemetry plugins on OpenCode V2 while preserving V1 compatibility. Require observable effects, prior web research and failing regressions before implementation.

- [OpenCode contract](./phase-1.md): compatible entrypoints, shared adapter and safe delivery.
- [Runtime proof](./verification.md): research first, failing regression, real hosts.
- [Accepted Kilo extension](./kilo-verification.md): complete hooks, configuration preservation and CI repair.
- [Final review](./review.md): quality and required gates.

Constraints: isolated profiles, local inference, unchanged mutation thresholds and bundle budget, user files untouched. Generic host adaptation belongs to the CLI; plugin-specific payload mapping stays with each plugin. Keep hook tests outside shipped plugin trees.
