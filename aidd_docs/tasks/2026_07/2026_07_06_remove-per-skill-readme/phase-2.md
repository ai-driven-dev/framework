---
status: pending
---

# Instruction: Verify and guard

## Architecture projection

> No file changes; this phase runs the gates that prove the QA holds.

```txt
.
└── (verification only — scripts/check-markdown-links.js, sync scripts)
```

## Tasks to do

### `1)` Broken-link gate (the QA#3 proof)

> Every markdown link that resolved to a now-deleted README must be gone.

1. Run `node scripts/check-markdown-links.js` from the repo root. It resolves relative links across all markdown; a dangling link to a removed README fails it.
2. Fix any residual dangling reference it reports (retarget to `SKILL.md` or drop), then re-run until clean.

### `2)` No per-skill README, no orphan skill

1. `find plugins -path '*/skills/*/README.md'` returns nothing.
2. Every skill directory that lost its README still has a `SKILL.md` (no orphaned skill dir).
3. The two asset READMEs and all plugin-level / framework READMEs remain.

### `3)` Generated artifacts consistent

1. `node scripts/sync-readme-counts.mjs --check` exits 0 (top-level counts unaffected).
2. Regenerated CATALOGs contain no `skills/*/README.md` rows.

### `4)` Durability

1. Confirm `aidd-context/04-skill-generate` does not scaffold a per-skill README (a newly generated skill would not reintroduce one).

## Test acceptance criteria

| Task | Acceptance criteria                                                                     |
| ---- | -------------------------------------------------------------------------------------- |
| 1    | `node scripts/check-markdown-links.js` exits 0 with no dangling README link reported.  |
| 2    | Zero `skills/*/README.md`; every affected skill dir still has `SKILL.md`; asset READMEs intact. |
| 3    | `sync-readme-counts.mjs --check` exits 0; no CATALOG lists a per-skill README.          |
| 4    | The skill generator emits no per-skill README.                                          |
