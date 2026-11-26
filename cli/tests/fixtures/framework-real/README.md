# framework-real fixture

A frozen copy of the framework's `plugins/` and `.claude-plugin/marketplace.json`.
`version.txt` records the framework version it was copied from.

It is the single source for the goldens (`tests/golden/`), the persona e2e journey
(`tests/e2e/persona.e2e.test.ts`) and the collision smoke (`scripts/smoke-collision.sh`).
It serves as a local marketplace, so none of them reach the network.

## Refresh

No script refreshes it. The goldens are frozen against these bytes: replacing the copy
means regenerating every golden in the same change, and reviewing that diff by hand.
