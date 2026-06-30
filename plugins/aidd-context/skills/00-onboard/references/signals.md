# Project signals and the capability map

What `01-read-project` captures into the snapshot, and which secondary tool each signal makes relevant. Stages and their order live in `journey.md`; this file is signals only.

## Cheap signals (presence tests)

| Signal          | Met when                                                            |
| --------------- | ------------------------------------------------------------------ |
| memory synced   | `aidd_docs/memory/` exists and its files hold real content         |
| context block   | the AI context file carries the `<aidd_project_memory>` block      |
| architecture    | `aidd_docs/INSTALL.md` exists                                       |
| code present    | any source outside `aidd_docs/` (a docs/README-only repo is empty) |
| manifest        | a stack manifest (`package.json`, `pyproject.toml`, `go.mod`, …)   |
| tests present   | real test files exist (a configured runner alone does not count)   |
| spec or plan    | a spec or plan under `aidd_docs/`                                   |
| plan status     | the `status` field of a `plan.md`                                  |
| open PR         | an open pull request on the current branch                         |

## Richer reads (bounded, once per session)

| Read              | Captures                                          |
| ----------------- | ------------------------------------------------- |
| code-quality sample | a file far longer or more deeply nested than its siblings = "messy" |
| bug-marker scan   | `TODO` / `FIXME` and reported errors              |

Reading memory-file contents to judge "synced" and this bounded code sample are the only sanctioned non-cheap reads.

## Capability map (signal → secondary tool)

Each tool is stage-gated: it surfaces only at the listed stage, and only beside the default, never as the default.

| Signal              | Stage         | Surfaces      |
| ------------------- | ------------- | ------------- |
| no test files       | build, review | add tests     |
| messy (code sample) | build, review | audit         |
| bug markers         | any           | debug         |

A tool resolves to an installed skill by description, or is named a gap by function. The flow default itself comes from `journey.md`, never from this map.
