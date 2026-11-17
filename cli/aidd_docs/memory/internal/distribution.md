# Distribution

- Where a plugin's content comes from: the registered marketplaces, the trust given to a source, the cache and the fetch.
- Language: `src/contexts/distribution/glossary.md`.
- Shape: the `reference-context.md` rule.

## Gotchas

- `marketplace add --overwrite` removes the old entry before it fetches the new one, so a failed fetch leaves the previous entry gone, as `tests/contexts/distribution/application/add-marketplace.unit.test.ts` pins.
