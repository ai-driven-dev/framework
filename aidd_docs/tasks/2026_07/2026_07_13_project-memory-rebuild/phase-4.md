---
status: done
---

<!-- Fill or omit these sections; never add, rename, or reorder one. -->

# Instruction: Cutover and headless verify

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
plugins/aidd-context/skills/02-project-memory/
├── SKILL.md                              ✏️ ref and asset lists point at the new files only
├── actions/
│   ├── 01-init-context-file.md           ❌ absorbed into 03-sync
│   ├── 02-scaffold-docs.md               ❌ absorbed into 02-generate
│   ├── 03-generate-memory.md             ❌ replaced by 02-generate
│   ├── 04-review-memory.md               ❌ absorbed into 02-generate
│   └── 05-sync-memory.md                 ❌ replaced by 03-sync
└── references/
    └── mapping-ai-context-file.md        ❌ merged into tools.md
```

## Tasks to do

### `1)` Remove the superseded files

> Delete only what the new three actions fully absorb.

1. Delete the five old action files.
2. Delete `references/mapping-ai-context-file.md`, its content now in `tools.md`.
3. Grep the skill for any dangling `@` reference to a deleted file, fix or remove it.

### `2)` Verify the skill is internally whole

> No broken link, no orphaned rule.

1. Run the repo link checker, expect zero broken links.
2. Confirm every action file is reachable from SKILL.md and reads only refs that exist.
3. Confirm no runtime instruction lives only in an authoring contract (the onboard lesson).

### `3)` Headless sweep on both hosts

> Prove it runs, not just that it reads.

1. Build fixtures: an existing repo with a stack and no memory, a repo whose tool wrote memory into `internal/`, and one for Codex whose `AGENTS.md` carries no block.
2. Sync this checkout into both tools' caches with `scripts/dev-sync.sh`, so the run tests the branch and not the released version.
3. Run `02-project-memory` headless on Claude across the fixtures, capture each output.
4. Run the same on Codex, capture its output.
5. Assert on disk, never on the report: core files flat, the picked tool's block filled, an unpicked tool's file untouched.
6. Record which review path ran. Both hosts have subagents today, so the no-subagent fallback stays unexercised and must not be reported as verified.

## Test acceptance criteria

<!-- Each criterion is an observable behavior, not a command. -->

| Task | Acceptance criteria                                                                        |
| ---- | ------------------------------------------------------------------------------------------ |
| 1    | The five old actions and `mapping-ai-context-file.md` are gone, no reference dangles.       |
| 2    | The link checker reports zero broken links across the skill.                                |
| 3    | Claude and Codex both run the three-action flow end to end, each output naming scan, generate, and sync. |
| 4    | Disk shows core memory flat, the picked tool's block filled, and an unpicked tool's file untouched. |
| 5    | The review ran with reviewers that did not write what they read, and the report names them. |
