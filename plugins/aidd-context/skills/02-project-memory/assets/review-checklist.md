# Review Checklist

Recurring defects the reviewer ticks on every code/diff review, so they get caught in any diff.

- [ ] **No information duplication** — DRY across code *and* docs; link to the canonical home instead of copying.
- [ ] **No incoherence / contradiction** — naming, behavior, and docs-vs-code stay consistent.
- [ ] **No over-engineering** — the simplest solution that meets the need; no speculative generality, no unused abstraction.
- [ ] **No dead code or debug leftovers** — no commented-out blocks, stray logs, or TODOs left silently.
- [ ] **Consistent with existing patterns** — follows the conventions already established in the codebase.
- [ ] **Clear, explicit naming** — names reveal intent; no misleading or vague identifiers.
- [ ] **Errors handled** — no swallowed exceptions, no ignored failure paths.
