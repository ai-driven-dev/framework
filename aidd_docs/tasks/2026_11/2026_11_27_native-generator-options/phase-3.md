---
status: done
---

# Instruction: Preserve rule configuration and verify installed outputs

## Architecture projection

```txt
.
├── plugins/
│   └── aidd-context/
│       └── skills/
│           ├── 05-rule-generate/
│           │   ├── actions/
│           │   │   └── ✏️ 03-plan.md
│           │   ├── assets/
│           │   │   └── ✏️ rule-template.md
│           │   ├── references/
│           │   │   ├── ✏️ hosts.md
│           │   │   └── ✏️ writer.md
│           │   └── scripts/
│           │       ├── ✏️ write-rule.cjs
│           │       └── ✏️ contract.json
│           ├── 00-onboard/
│           │   └── references/
│           │       └── state/
│           │           └── ✏️ detection.md
│           ├── 02-project-memory/
│           │   └── references/
│           │       └── ✏️ tools.md
│           ├── 04-skill-generate/
│           │   └── references/
│           │       └── ✏️ tool-detect.md
│           ├── 06-agent-generate/
│           │   └── references/
│           │       └── ✏️ hosts.md
│           ├── 07-command-generate/
│           │   └── references/
│           │       └── ✏️ hosts.md
│           └── 08-hook-generate/
│               └── references/
│                   └── ✏️ hosts.md
└── scripts/
    └── __tests__/
        ├── ✏️ rule-generation.test.js
        └── ✏️ generator-hosts.test.js
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | Prepare existing rule sources, commented configs and a legacy Kilo-only project | The original content and detected targets are known | system |
| Happy path | Publish a rule with native options, then publish it again | Options persist in the rule source and only the intended target receives them | cli |
| Edge case | Edit commented JSONC containing trailing commas and duplicate instructions | Comments and existing entry order survive, and the glob is added at most once | cli |
| Edge case | Give ambiguous configs, invalid instructions or conflicting shared output | The skill requests a file selection where applicable and the writer refuses unsafe input before writing | cli |
| Edge case | Generate from a project with only .kilocode/ | Kilo is detected and the artifact uses its canonical path | cli |
| Teardown | Remove temporary configurations and runtime artifacts | The original workspace and host settings are intact | system |

## Tasks to do

### `1)` Support native rules and JSONC edits

> Keep the shared publisher as the owner of rule output

1. Persist rule native options in the existing canonical source so publish can reproduce them. Move the source template and contract together and validate both existing and new source forms. Use the target's existing rule metadata or config surface. Preserve ownership, signed copies and the Kilo/OpenCode shared-copy behavior. Refuse incompatible shared output.
2. Reuse a proven JSONC edit mechanism only after confirming it can ship and run with the isolated skill. The CLI adapter is a reference. Edit the instructions array without reserializing the document, asking for a target when applicable. Reject malformed config and unsafe target paths before writes.
3. Extend rule tests with every declared target, add and publish, mixed targets, malformed config, explicit selection and a byte comparison of untouched configuration text.

### `2)` Recognize legacy Kilo projects

> Use a detection-only marker

1. Update Kilo detection in onboarding, project memory and all five generators. Keep canonical paths, leave .kilocode/ untouched and retain OpenCode-only negative coverage.
2. Review the acceptance criteria against the delivered behavior and record the flat rules, single glob and official sources in the SDLC outcome for the linked issue.

### `3)` Run delivery gates and host trials

> Prove the installed output and document the evidence

1. Run `node scripts/check/engine/sync.cjs`, `node scripts/check/run.cjs` and `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'`. Run the repository pre-commit gate before committing; run the CLI gates if shared packaging changes CLI files.
2. Exercise official validators and isolated runtime trials where available. Prioritize Kilo discovery, a denied edit in a disposable workspace and the separate session for subtask. Use locally installed runtimes, verify their runnable entry points, remove trial artifacts and classify unavailable runtime checks by reason.
3. Check the standalone install and every generator–host pair across all five suites. Compare project architecture, scope and gates with the repository assertions.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Native rule options survive republish. Existing rules behave as before, and JSONC edits preserve comments, formatting outside the edit and existing instructions. |
| 2 | A .kilocode/-only fixture is recognized by every applicable workflow, without producing files beneath .kilocode/ or misidentifying an OpenCode-only project. |
| 3 | Full scripts and content gates pass. Each supported pair has a generated-file record, with host observations distinguished from unverified runtime behavior. |
