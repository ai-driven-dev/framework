# Distribution

Where a plugin's content comes from: registered marketplaces, source trust, cache and fetch. Language: `cli/src/contexts/distribution/glossary.md`.

## Gotchas

- `marketplace add --overwrite` removes the old entry before fetching: a failed fetch leaves no entry.
- `cli/tests/orchestration/marketplace/marketplace-add-order.integration.test.ts` pins that order.
