> **Resolution (2026-02-27):** Node 24 LTS adopted as engine baseline.
> Critical #1 (`import.meta.dirname`) is resolved natively.
> High #3 (`@types/node`) resolved by ^24.0.0.
> Remaining fixes applied per plan abstract-finding-rain.

# Code Review — M0 Implementation

**Date:** 2026-02-27
**Scope:** `git diff main` — M0 tickets 001, 002, 003
**Diff stats:** 122 files changed, 726 insertions, 13552 deletions

---

## Critical

### `vitest.config.ts:8` — `import.meta.dirname` requires Node 21.2+

```ts
"@": resolve(import.meta.dirname, "src"),
```

Engine constraint is `node >= 20`. `import.meta.dirname` was introduced in Node 21.2.0 / 22.0.0.
This will crash on any Node 20.x runtime.

**Fix:** Replace with `dirname(fileURLToPath(import.meta.url))`.

---

## High

### `tests/smoke.test.ts:14` — Test depends on `dist/cli.js` without prior build

```ts
const output = execSync(`node ${resolve(root, "dist/cli.js")} --version`, ...)
```

`pnpm test` script is `vitest run` — it does not build first.
If `dist/` is absent or stale, this test fails in CI and on fresh clones.

**Fix:** Either add a `prebuild` step to the test script (`"test": "pnpm build && vitest run"`), or move the smoke test to a separate `test:e2e` script.

### `package.json:devDependencies` — `@types/node` version mismatch

```json
"@types/node": "^25.3.2"
```

Engine requires `>= 20`. `@types/node@25` targets Node 25 APIs — adds noise and type pollution.
**Fix:** Use `@types/node@^20` or `@types/node@^22`.

---

## Medium

### `src/cli.ts:6-11` — Runtime `readFileSync` for version is fragile

```ts
const packageJson = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8")) as { version: string };
```

- Adds runtime file I/O on every CLI invocation.
- Fragile when package is installed globally and directory layout changes.
- Standard pattern: hardcode version at build time via `tsup` `define` or `--env`, or just inline the string.

**Fix:** Hardcode version in `cli.ts` as a constant, or use `tsup`'s `define: { __VERSION__: JSON.stringify(pkg.version) }`.

### `src/presentation/presenter.ts` — Not a placeholder; scope creep

Ticket 003 specifies `presenter.ts` as a placeholder. Instead, it implements `present()` with `OutputLevel` typing and emoji prefixes.
Rules: *No extra feature, focus only on core functionality.*

**Fix:** Reduce to `export {};` placeholder matching the ticket spec, or document this as intentional early implementation.

### `tsconfig.json` — Removed `noImplicitReturns` and `noFallthroughCasesInSwitch`

Original tsconfig had both. These catch real bugs (missing return branches, fall-through switch cases).
Removing them weakens static safety for no stated reason.

**Fix:** Restore both flags.

### `biome.json:linter.rules.style.noNonNullAssertion` — Downgraded from error to warn

```json
"noNonNullAssertion": "warn"
```

Non-null assertion (`!`) bypasses null-safety checks. Warn-level lets them slip through unnoticed in strict codebases.
**Fix:** Set to `"error"`, or omit to inherit `recommended` default (which is error).

### `tests/fixtures/framework.json` — Template files referenced but missing

```json
"templates": {
  "memoryBank": "templates/memory-bank.md",
  "docsReadme": "templates/docs-readme.md"
}
```

Neither `tests/fixtures/templates/memory-bank.md` nor `docs-readme.md` exist.
Tests don't validate this — silent broken reference in the fixture.

**Fix:** Create stub files or change paths to point to existing files.

---

## Low

### `tests/structure.test.ts:48,52` — `readFileSync` + `JSON.parse` called 3 times

```ts
JSON.parse(readFileSync(fixturePath, "utf-8"))  // line 48
JSON.parse(readFileSync(fixturePath, "utf-8"))  // line 52
JSON.parse(readFileSync(fixturePath, "utf-8"))  // line 58
```

Duplicate I/O on the same file. Violates "eliminate duplication ruthlessly."

**Fix:** Parse once at the `describe` scope and reuse.

### `package.json:packageManager` — Pinned to `pnpm@9.0.0` (outdated patch)

```json
"packageManager": "pnpm@9.0.0"
```

`9.0.0` is the first release of the 9.x line and has known bugs. Should pin to a specific stable patch (e.g., `9.15.x`) or the latest 9.x.

### `biome.json` — Ignores all `*.json` files

```json
"files": { "ignore": ["dist/**", "node_modules/**", "*.json"] }
```

Blanket ignore of `*.json` means `package.json`, `tsconfig.json`, and fixture files won't be formatted by biome. This is usually unintentional and skips biome's JSON formatting/validation capabilities.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 1     |
| High     | 2     |
| Medium   | 5     |
| Low      | 3     |
| **Total**| **11**|

**Blocking for M1:** The `import.meta.dirname` issue (#1) must be fixed as it will cause test failures on Node 20. The smoke test build dependency (#2) should be resolved before CI is configured.
