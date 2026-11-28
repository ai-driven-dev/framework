---
status: done
---

# Instruction: Generate native agent and command options

## Architecture projection

```txt
.
├── plugins/
│   └── aidd-context/
│       └── skills/
│           ├── 06-agent-generate/
│           │   ├── actions/
│           │   │   └── ✏️ 02-plan.md
│           │   ├── references/
│           │   │   └── ✏️ writer.md
│           │   └── scripts/
│           │       └── ✏️ write-agent.cjs
│           └── 07-command-generate/
│               ├── actions/
│               │   └── ✏️ 02-plan.md
│               ├── references/
│               │   └── ✏️ writer.md
│               ├── assets/
│               │   └── ✏️ command-template.md
│               └── scripts/
│                   ├── ✏️ write-command.cjs
│                   └── ✏️ contract.json
└── scripts/
    └── __tests__/
        ├── ✏️ agent-generation.test.js
        ├── ✏️ command-generation.test.js
        └── check/
            └── ✏️ command-contract.test.js
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | Run the existing suites and prepare isolated multi-host fixtures | Current output is captured | system |
| Happy path | Generate Kilo agents and commands with native options | Numeric temperature, nested permission, string variant and boolean subtask are preserved | cli |
| Edge case | Pass native options for a different target or collide with a managed field | The writer reports the target and field before changing any output | cli |
| Edge case | Generate without options, preview and apply twice | Existing output is unchanged and the second apply is idempotent | cli |
| Teardown | Clean temporary workspaces | No generated artifact remains | system |

## Tasks to do

### `1)` Define the writer input

> Keep the portable draft and scope native values to their selected host

1. Consult official docs for options requested during planning. Pass documented values in a host-keyed object such as `nativeOptions.kilo`. Keep portable input and output compatible.
2. Reuse the existing host renderer and its format. Accept JSON-compatible values only where serializable, preserve their types, and reject collisions with managed fields such as an agent mode or an existing effort mapping.
3. Validate every selection before writing. Refuse a selected host with no compatible native surface when options were requested.

### `2)` Extend the current tests

> Prove behavior through both installed writers

1. Add red tests for the four Kilo fields and equivalent representative fields for each existing agent and command target with a native field surface.
2. Assert legacy output, invalid values, reserved-field collisions, a selected target without native fields, preview and repeatability. Use official schemas or validators where available.
3. Keep strict canonical command validation and validate generated native commands against their target format. Update the command template and its contract together as needed, synchronize the installed hook copy, and prove that a generated Kilo command with variant and subtask passes the bundled check.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | A multi-host fixture proves that each target receives only its own native values and refusals preserve all files. |
| 2 | Both writer suites cover every declared target and run from an isolated installed skill tree. A generated Kilo command passes the installed contract, which still rejects unexpected fields in a canonical command. |
