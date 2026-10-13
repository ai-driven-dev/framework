# Remaining dependency advisory remediation

Base: `next` at `4704286066d57e8469b02f3953d0f86ebbb38f55`, after #1011.

## Resolution

The CLI workspace policy and regenerated lockfile update three dependencies:

- fast-uri `3.1.7` → `3.1.8`, bounded by `~3.1.8`.
- qs `6.15.2` → `6.16.0`, bounded by `~6.16.0`.
- esbuild `0.27.3` → `0.28.2`, bounded by `~0.28.2`.

The only accompanying package changes are esbuild's 26 platform binaries and side-channel `1.1.0` → `1.1.1`, required by qs. The six security patches delivered in #1011 remain at their tested versions. Direct dependency declarations, Stryker's Vitest patch, application source and tsup configuration are unchanged.

## Compatibility decisions

### fast-uri

AJV's `^3.0.1` accepts the patched version. The actual AJV-resolved package reproduces the percent-encoded host mismatch on `3.1.7`: `parse('//%41.com').host` is `A.com`, and equality with `//a.com` is false. On `3.1.8`, the host is `a.com` and equality is true. Relative external schema references still accept valid strings and reject short strings and numbers.

Source: [GHSA-hrr3-gc8f-f4qj](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj).

### qs

Stryker `10.0.0` still requires typed-rest-client `~2.3.0`; the latest matching parent `2.3.1` pins qs `6.15.1`. The existing override already superseded that exact pin. Raising this override to `6.16.0` remains an explicit exception to the parent's declared range.

Moving typed-rest-client to `3.1.2` would also exceed Stryker's parent range and change HTTP URL, redirect and proxy handling. Keeping the existing parent confines this remediation to its only qs call, `stringify`, while preserving those HTTP semantics.

The actual installed typed-rest-client `2.3.1` made five baseline and five candidate loopback requests. Methods, URLs, headers and bodies matched: four registry GETs covered repeat/comma/indices/brackets arrays, separators, dot keys, Unicode and escaping; a dashboard PUT preserved status and response handling. Both advisory reproductions fail on `6.15.2` and pass on `6.16.0`.

Sources: [Stryker parent constraint](https://raw.githubusercontent.com/stryker-mutator/stryker-js/v10.0.0/packages/core/package.json), [query serialization](https://raw.githubusercontent.com/microsoft/typed-rest-client/master/lib/Util.ts), [qs changelog](https://raw.githubusercontent.com/ljharb/qs/v6.16.0/CHANGELOG.md), [GHSA-x5fp-wj9c-mxmx](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx), [GHSA-4mjr-xmp4-gh2g](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g).

### esbuild

The latest tsup remains `8.5.1`, requiring esbuild `^0.27.0`; this override deliberately exceeds that range. Vite `8.3.2` accepts `^0.27.0 || ^0.28.0`, and bundle-require `5.1.0` accepts `>=0.18`.

Upstream API declarations for `0.27.3` and `0.28.1` are byte-identical; `0.28.2` adds optional logging configuration. tsup's consumed `build`, `transform`, `formatMessages` and plugin interfaces remain available. The patched Windows development-server advisory does not require replacing the build tool.

Real tsup probes against both installed graphs passed: TypeScript configuration loading, ESM/node20 output, syntax/whitespace minification, CSS extraction with a PostCSS plugin marker and version `8.5.28`, CSS injection executed with a mock document, and a bundle-require configuration watch/rebuild (`first` → `rebuilt`, numeric export `43` preserved). Extracted and injected CSS matched the baseline byte-for-byte. Probes removed inherited `NODE_PATH`; watchers were stopped.

Sources: [tsup constraint](https://raw.githubusercontent.com/egoist/tsup/v8.5.1/package.json), [esbuild 0.28.0](https://github.com/evanw/esbuild/releases/tag/v0.28.0), [security fix](https://github.com/evanw/esbuild/releases/tag/v0.28.1), [0.28.2 fixes](https://github.com/evanw/esbuild/releases/tag/v0.28.2).

## Measured bundle adjustment

The old compiler produced 768,761 bytes (750.7 KB); the patched compiler produces 773,769 bytes (755.6 KB). The 5,008-byte increase consists of 417 newly emitted parameter-property field declarations (4,988 bytes) and three additional field changes (20 bytes).

This is the [TypeScript define-semantics correction introduced in esbuild 0.27.5](https://github.com/evanw/esbuild/releases/tag/v0.27.5). The minimum patched `0.28.1` produces the same size. Disabling those semantics would conceal the compiler correction. Changing identifier minification would unnecessarily expand the build behavior change.

Following the existing measured-budget policy, `bundleBudgetKB` moves from 751 to 756 KB, leaving approximately 0.05% headroom. The budget registry records the measurement and reason. Minification settings and application code remain unchanged; all other quality thresholds remain unchanged.

## Audit result

Separate full and production `pnpm audit --json` runs on 2026-10-13:

- Full graph: four advisory IDs (three moderate, one low) → zero at every severity.
- Production: one moderate advisory → zero at every severity.
- Development-only: three advisory IDs → zero.

No advisory is suppressed. This describes the audited graph on this date, not a guarantee against future disclosures.

## Validation

Fresh root and CLI frozen installations pass with pnpm `12.3.4`. The focused compatibility checks above run against the installed candidate graph. Build passes at 755.6/756 KB. Typecheck, type honesty, lint, knip and duplication checks pass; duplication remains 1.62% against the unchanged 3.3% limit. Lint retains the pre-existing unused private `fs` warning in `uninstall-use-case.ts`.

`pnpm test:coverage` passes: 540 test files and 7,025 tests passed, one file/test skipped. Coverage meets the unchanged thresholds: statements 98.77%, branches 95.77%, functions 99.55%, lines 99.39%. The mutation canary passes at score 100 against the unchanged floor 100.

Independent review found no defects in the five-file change and its local validation evidence. Windows and all mutation scopes must pass on the final candidate before merge. Their final results belong in the PR evidence.

## Rollback

Revert the override, generated lockfile and measured-budget change together. This restores the prior dependency graph and its four known advisories; no persisted user data or configuration is migrated.
