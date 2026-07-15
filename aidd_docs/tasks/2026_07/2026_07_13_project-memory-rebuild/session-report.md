# Project-memory rebuild — session report

Branch `feat/project-memory-rebuild`, off `origin/next`. Nothing pushed. Eight commits landed; a second pass (file-by-file review, mermaid, smoke test) is uncommitted.

## What changed, in one line

The five-action memory skill became three (`scan → generate → sync`) on the onboard anatomy: each action asks its own question when the answer is used, every memory file lands flat where a table says, and an independent review runs before anything is trusted.

## The shape

```
scan ──▶ generate ──▶ sync        (set up or refresh)
                       ▲
            re-wire ───┘          (a tool needs wiring, memory already there)
```

- **scan** reads the project, confirms the capabilities. Stops if there is nothing to remember.
- **generate** scaffolds `aidd_docs/`, writes each memory file to its forced flat path, reviews with independent agents, reports.
- **sync** picks the tools, creates or wires each tool's context file, fills the block with the script.

Files: `SKILL.md` + 3 actions + 6 references + 5 assets + 22 memory templates. `references/memory-block.md` deleted (its shape lives in the asset, its fill in the script).

## The eight committed changes

1. Router: three actions, mermaid, load-bearing "read the action file" line.
2. generate writes to a forced template→path table — the client nesting bug fixed at the root.
3. sync wires only the picked tools; the script takes a tool list, still stages nothing when the skill calls it.
4. The five old actions and the AI map retired; catalogs fixed.
5. Each action asks its own question: tool pick moved scan→sync, so sync runs alone; scan gained the empty-project guard.
6. A memory file on an older template shape is reported, never rewritten.
7. Memory-content rules moved to `references/memory-rules.md`, loaded by generate, never by sync.
8. No neighbour plugin named; tests state observables, not restated rules.

## The uncommitted second pass

A file-by-file review with the user, then mermaid, then the smoke test.

- **SKILL.md** — description recentred on the project (architecture, conventions, decisions), active verb, no dash. Mermaid shows both entries (set up / re-wire). Number column dropped (the flow branches). Transversal rules gained "create or revise, keeping the user's edits; delete only when asked".
- **01-scan** — Ground/Find/Ask/Confirm, a stop sub-bullet for the empty project, observable tests.
- **02-generate** — Output one line; Write and Prune split coherently (Write owns selected files, Prune owns orphans); Review and Fix separated; report shaped by `assets/report.md`; tests grouped always / by-case.
- **03-sync** — Require guard, tool pick, upsert folded to reference the asset shape, reconcile-on-drift offer, guard trimmed, observable tests.
- **references** — `tools.md` two rules only; `capability-signals.md` one framing line + table, files column dropped (lived in destinations), `monorepo` removed (codebase-map's job); `memory-destinations.md` a pure mapping; `memory-rules.md` "A memory file:" properties; `review-protocol.md` a numbered protocol addressed to the reviewer, expanded to catch dead commands, invented rationale, and omissions; `structure.md` new, the scaffold tree.
- **assets** — `report.md` new (the generate report shape). `templates/memory/README.md` load model as a mermaid, maintenance rules aligned with `memory-rules.md`, orphan 200-line dropped.
- **mermaid** — `database` ER (a restated schema) replaced by an optional domain diagram; `auth` and `deployment` gained an optional, gated flow diagram; every diagram gated "only when non-trivial, never a derivable schema or tree".
- **script** — `updateMarkers` anchors on the close then the nearest open, so a marker quoted in prose above the block no longer splices out the text between.

## Defects found and fixed this session

- Ten adversarial audit agents: the review protocol's generic "breach of memory-rules" subsumed its own specific flags; the dedup check needed file contents but the reviewer only reads names. Both reframed.
- File-by-file review: cross-plugin coupling in the review protocol, an AImemory-rules dup with the README, a database ER that restated the schema, tests that restated rules.
- Smoke test: `update_memory.js` had no test and the runner is not wired to CI (a repo-level gap, ticketed, not this rework).

## Verified in execution — 31/31 on disk, both hosts

See `smoke-test.md`. Ten fixtures, every claim read off disk. Ground-stop, full flow, bare-AGENTS insert, standalone sync, Require-stop, drift-report, Prune flag+offer+decline, shared-AGENTS, reconcile-offer, gated mermaids.

## The one asymmetry — review by host

- **Claude** fans out real independent `aidd-dev:checker` reviewers (9 on F2, 4 on F10) that caught stub-overstatement and duplication and fixed them. The prerogative is met.
- **Codex** self-passes: "ran without subagents, one fresh pass; no fixes needed." `codex exec` headless does not spawn real subagents; an earlier run that named reviewers was persona role-play, not fan-out. The skill degrades as designed and reports it, but Codex gets a self-review, not an independent one.

Content and structure are sound on both. Independent review is real only on Claude. Accepting the Codex self-pass, or requiring independent review on every host, is a product call.

## Not proven

- Accepting a Prune removal or a reconcile: headless offers but cannot answer; only the decline path is proven.

## Deferred, needs a ticket

- Wire `node --test` into CI, then unit-test `update_memory.js` (`updateMarkers`, `resolveTargets`).
- `skill-authoring.md` sanctions (nested refs, inline `@`, mermaid for loops, router format) — untouched on this branch by standing constraint.
