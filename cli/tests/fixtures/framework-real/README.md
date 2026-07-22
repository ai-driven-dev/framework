# framework-real fixture

Pinned snapshot of aidd-framework tag **v4.1.0-beta.12**.

Used by `tests/e2e/persona.e2e.test.ts` as a local marketplace source
(avoids network calls, deterministic content).

## Refresh

```bash
pnpm fixture:refresh
# or pin to a specific tag:
bash scripts/refresh-framework-fixture.sh v4.1.0-beta.12
```

The script archives `plugins/`, `.claude-plugin/marketplace.json`, and
`version.txt` from the framework repo at the given tag.
