---
status: pending
---

# Instruction: regenerate 05-review and 08-hook-generate

## Architecture projection

```txt
plugins/aidd-dev/skills/05-review/          ✏️ regenerated through the generator
plugins/aidd-context/skills/08-hook-generate/ ✏️ regenerated: diagram, no Test, no actions table
```

## User Journey

```mermaid
flowchart TD
  A[run generator in modify mode] --> B{matches the format?}
  B -->|no| C[fix the generator] --> A
  B -->|yes| D[done]
```

## Test Scope

```mermaid
---
title: Test scope
---
journey
  section Setup
    {phase 1 merged in the tree} => {generator ready}: 5: system
  section Happy path
    {regenerate 05-review} => {every lean criterion passes by measurement}: 5: cli
    {regenerate 08-hook-generate} => {judged by hand against the brief's format}: 5: cli
```

## Tasks to do

### `1)` Regenerate 05-review

> Measured: it must already satisfy the format, so the run proves the generator.

1. Run modify; diff against the current tree; fix the generator on mismatch.

### `2)` Regenerate 08-hook-generate

> It carries the old format: actions table, `## Test`, "run each action's `## Test`".

1. Run modify; replace the table with a flowchart; remove every `## Test`.
2. Do not apply the framework hook contract to the hooks it generates.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Diagram nodes equal action files; no Test section; actions under 100 lines |
| 2 | Same, plus a reviewer finds no behavior lost from the old version |
