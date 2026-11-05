---
objective: "Every review finding on the Antigravity stack is fixed in the commit that owns it, or answered, and each stacked branch passes its gates."
status: implemented
---

# Plan: Antigravity stack review fixes

## Overview

| Field      | Value                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------- |
| **Goal**   | Address the review on the five stacked Antigravity pull requests without reshaping the stack |
| **Source** | Review comments on the Antigravity pull request stack, backlog item in `backlog-link.json`  |

## Phases

| #   | Phase                                                    | File                         |
| --- | -------------------------------------------------------- | ---------------------------- |
| 1   | Host profile: user-facing skip message, conformance guard | [`phase-1.md`](./phase-1.md) |
| 2   | Project hooks: `--force` reaches the edit guard           | [`phase-2.md`](./phase-2.md) |
| 3   | Agents: bundle figures, bracketed frontmatter values      | [`phase-3.md`](./phase-3.md) |
| 4   | Docs and runtime smoke                                    | [`phase-4.md`](./phase-4.md) |
| 5   | Replay the stack, gate each branch, draft the replies     | [`phase-5.md`](./phase-5.md) |

## Decisions

| Decision | Why |
| --- | --- |
| `--force` lifts only the "edited after install" refusals; ownership proofs still refuse | `--force` means "overwrite my edits to what AIDD wrote", never "touch what AIDD cannot prove it wrote" |
| A confirmed interactive `clean` without `--force` still refuses an edited hook | the escape hatch stays explicit and scriptable |
| Each fix is a fixup of the commit that owns the code, autosquashed with `--update-refs` | every pull request keeps its own diff; no new branch enters the stack |
| A project-delivered hook script belongs to the hooks provenance only, never to `plugins[].files` | one file, one owner: two records let `clean` delete without the edit check and `sync` see drift twice |
