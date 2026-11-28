---
status: done
---

# Instruction: Apply native options to skills and hooks

## Architecture projection

```txt
.
├── plugins/
│   └── aidd-context/
│       └── skills/
│           ├── 04-skill-generate/
│           │   ├── actions/
│           │   │   ├── ✏️ 02-plan.md
│           │   │   └── ✏️ 03-write.md
│           │   ├── references/
│           │   │   └── ✏️ tool-write.md
│           │   └── scripts/
│           │       ├── ✏️ scaffold-skill.cjs
│           │       └── ✏️ contract.json
│           └── 08-hook-generate/
│               ├── actions/
│               │   └── ✏️ 02-plan.md
│               ├── references/
│               │   └── ✏️ writer.md
│               └── scripts/
│                   └── ✏️ write-hook.cjs
└── scripts/
    └── __tests__/
        ├── ✏️ scaffold-skill.test.js
        └── ✏️ hook-generation.test.js
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | Prepare project fixtures for each selected host and shared skill directory | Existing files, unrelated hooks and baseline output are available | system |
| Happy path | Generate or update native skill metadata and a documented hook option | Native values land only in the target file or owned entry | cli |
| Edge case | Preview a valid skill or hook change | Target paths and options are shown and the fixture stays byte-identical | cli |
| Edge case | Select two hosts that share a skill path and request identical options for both | The generator plans a single write | cli |
| Edge case | Select a shared path with different options, including an option requested by only one host | The generator reports the shared path and hosts before writing | cli |
| Edge case | Request an option for a hook without that capability | The writer reports the incompatibility before writing | cli |
| Regression | Generate a skill and a hook without native options | Both outputs match the existing baseline byte for byte | cli |
| Edge case | Repeat generation and remove an owned hook | Output is stable and unrelated hook entries survive | cli |
| Teardown | Remove fixtures | The project under test is restored | system |

## Tasks to do

### `1)` Apply native metadata to skills

> Handle both new scaffolds and existing skill updates

1. Use the existing scaffold and write workflow for native frontmatter while preserving name, description, router and actions. Apply the same preflight on edits without missing files.
2. Group the selected targets by their existing output path. At a shared path, write once only if the requested native options are structurally equal for all selected targets, treating absent options as an empty object. Report the path and targets and stop before writes when they differ. Keep canonical plugin sources on their existing path and format.
3. Show native metadata and target paths in the existing plan step without writing any files. Keep the skill contract aligned with documented native metadata and run the current validator on each output.

### `2)` Extend native hook configurations

> Retain host event, trust and ownership behavior

1. Reuse the existing host describes, config formats and plugin handlers. For command hooks, insert documented native settings only in the owned entry. For plugin hooks, use the existing native module input.
2. Protect controlled values including event, command and path. Keep update and remove scoped to existing ownership, show native changes in preview and use the existing hook fixtures.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Every listed skill target has a fixture for successful generation or a documented refusal. Identical requests at a shared path result in one write. Different requests, including a missing option, and valid preview leave the project intact. A no-options run matches the existing baseline. |
| 2 | Each supported hook target has a representative generation case, with config-preservation, capability refusal, no-options baseline and repeatability verified. |
