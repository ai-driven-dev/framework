---
status: done
---

# Instruction: Preserve the legacy Claude catalog and document installation

## Architecture projection

```txt
.
├── .claude/
│   ├── marketplace.json ✅
│   └── settings.json ✏️
├── .claude-plugin/
│   └── marketplace.json ✏️
├── .github/
│   └── workflows/
│       └── ci.yml ✏️
├── aidd_docs/
│   └── memory/
│       └── deployment.md ✏️
├── cli/
│   └── tests/
│       └── architecture/
│           └── ports-are-called.arch.test.ts ✏️
├── docs/
│   ├── COMPATIBILITY.md ✏️
│   ├── INSTALL.md ✏️
│   ├── MAINTAINERS.md ✏️
│   └── SUBAGENTS.md ✏️
├── plugins/
│   └── aidd-*/
│       └── README.md ✏️
└── scripts/
    └── publish-marketplace.cjs ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | Install from a historical Claude catalog in a clean profile. | Claude Code reports the legacy marketplace and installed version. | cli |
| Happy path | Simulate two released snapshots, then migrate to the new catalog. | Legacy updates during the overlap, both catalogs can be registered, and user/project enablement and plugin settings carry across catalog IDs. | cli |
| Edge case | Publish a third release and retry prior runs. | Legacy remains at release two and the current catalog advances. | system |
| Edge case | Extract the legacy ZIP and install it locally. | Relative sources resolve inside the ZIP. | cli |
| Teardown | Remove isolated profiles and repositories. | Existing user settings are untouched. | system |

## Tasks to do

### `1)` Keep the historical Claude URL compatible

> Preserve legacy identity and release windows while retaining the self-contained local marketplace.

1. Point the historical catalog at the compatibility ref while preserving local generation and ZIP behavior.
2. Document per-client URLs, supported modes, the transition, and real-client verification limits. Run `make check` and release workflow checks.
3. Keep the CLI architecture guard within its existing timeout by skipping receiver scans for files that cannot contain the call.
4. Register a separate project marketplace for framework development and update user-facing Claude Code install commands to select the published catalog.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Claude can update from the old URL during the overlap; the final snapshot remains accessible; the documentation reflects verified behavior. |
