---
status: done
---

# Instruction: Publish and verify generated catalogs

## Architecture projection

```txt
.
├── .github/
│   └── workflows/
│       ├── ci.yml ✏️
│       └── marketplace-dry-run.yml ✅
└── scripts/
    ├── marketplace-distribution.json ✅
    ├── publish-marketplace.cjs ✅
    ├── verify-marketplace.cjs ✅
    └── release-recap.js ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | Build translated catalogs and seed an isolated Git remote. | Native ZIP layouts and an empty distribution remote are available. | cli |
| Happy path | Publish each catalog and install through the available real clients. | Each tool branch and version tag serve the expected content. | cli |
| Edge case | Replay a release or attempt to publish an older version. | Existing version refs remain immutable and the stable branch is never rolled back. | system |
| Edge case | Fail one catalog publication. | Other tools remain independently publishable and the recap reports the result. | system |
| Teardown | Remove isolated checkout, remote, and client profiles. | Existing user installations are untouched. | system |

## Tasks to do

### `1)` Publish release archives as native Git catalogs

> Reuse the staged release assets and publish an immutable version and stable ref independently per client.

1. Add the distribution manifest, safe publication script, CI matrix, and recap entry. Confirm the public destination and AIDD App write grant before activation, or report them as deployment blockers.
2. Add clean-profile installation checks for clients that support unattended checks. Run local Git publication and real-client checks before the release workflow can publish. Verify Cursor installation and version in an authorized team client, or qualify the documented support until evidence exists.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Release content matches the generated assets, replays keep version tags intact, and supported client checks use the same source URLs as installation documentation. |
