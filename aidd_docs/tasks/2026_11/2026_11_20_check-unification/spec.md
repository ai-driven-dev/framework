# Framework checks unified behind contracts

Addendum to the locked spec `aidd_docs/tasks/2026_11/2026_11_20_contract-validation/spec.md` (#1149), which stays unchanged; covers #1149 (rest) and PR #1316.

## Target

Content is checked by contracts, code is checked by tests. One command checks every framework content file and refreshes generated docs; nothing else checks content.

## Target tree

```
scripts/check/
├── run.cjs              the one entry: check all, check given files, --fix regenerates
├── baseline.json        tolerated findings of today's tree, only shrinks
├── engine/              engine, ops, markdown, sync (source of the skills' lib copies)
├── contracts/           repo contracts, each naming its own targets
│   ├── plugin.json · hooks.json · report.json · doc.json · repo.json
│   ├── schemas/
│   └── custom/          code for a rule the generic ops cannot express, called only by a contract
└── generators/          catalogs, README counts and grid, written by --fix only
plugins/*/skills/*/scripts/contract.json   skill, rule, agent, command, plan, run, story contracts
scripts/__tests__/       code tests only
```

## Hard constraints

- Everything in the locked spec still holds: deterministic, no network, Node built-ins only, framework without the CLI, skills self-contained.
- A contract names the files it applies to; no separate mapping file exists.
- Without `--fix`, nothing is written; a stale generated file is a finding.
- A check given some files judges only the artifacts those files belong to, and baseline staleness only for those artifacts.
- Moving a check never changes what it reports on today's tree.

## Stays outside `run.cjs`

| Check | Why |
| --- | --- |
| YAML syntax | needs `js-yaml`, a dependency |
| COMPATIBILITY.md and README tool list | read the CLI's tool-support record |
| Recipe validity | built by the CLI until a RECIPE contract exists (separate ticket) |
| Code tests (`node --test`) | test code, not content |
| `check-hosts.cjs` | manual tool, not a gate |

## Non-goals

- Fixing today's findings.
- The RECIPE contract.
- Writing into `cli/`; the telemetry test moves to `cli/tests/telemetry/` only after the CLI side holds it, with the user's go.

## Done-when

- `validate.config.json`, `scripts/contract/`, the `check-*.js` content scripts, `validate-json.mjs` and `sync-readme-counts.mjs` no longer exist.
- `run.cjs` on today's tree exits 0 with the same baseline findings, minus the three SKILL-17 asset false positives.
- Every test replaced by a rule was (a) silent on today's tree as a rule, (b) seen to exit 1 with its rule id after one mutation, (c) only then deleted.
- `check-skill-argument-hints`, the architecture agent branch and the 22 review prose tests are deleted; router coherence is deleted only once no baselined SKILL-06 no-flowchart finding remains.
- Pre-commit runs one framework entry plus tests, YAML, the CLI-coupled entries and the CLI's own commands; CI runs the same.
- A staged-files run on a clean tree exits 0, and a new finding in a staged file exits 1.
- Every repository test still passes.

## Context

- https://github.com/ai-driven-dev/framework/issues/1149
- https://github.com/ai-driven-dev/framework/pull/1316
