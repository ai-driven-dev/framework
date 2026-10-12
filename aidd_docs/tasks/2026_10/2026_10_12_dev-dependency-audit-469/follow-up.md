# fix(cli): patch six development dependencies without a test-framework migration

Published as [#1008](https://github.com/ai-driven-dev/framework/issues/1008), native type Task, AIDD Roadmap project 8, Priority High and status Todo. No labels, assignees or milestone. Parent discovery: #469. Content follows the repository's Detailed Contribution form.

## Problem

The refreshed audit of `next` at `3e67f6f594b7b7f6cc7bceb0581ad6d515519080` finds 18 development-only advisories, including 12 high-severity advisories across six transitive packages. Vitest and Vite themselves are no longer reported. These dependencies execute on developer machines and CI, outside the CLI production graph.

## Scope

- Patch only the six verified transitive resolutions: brace-expansion 5.0.12, browserslist 4.28.7, js-yaml 4.3.2, nanoid 3.3.18, postcss 8.5.28 and source-map-js 1.2.2.
- Adjust `cli/pnpm-workspace.yaml` and regenerate the CLI lockfile with pnpm 12.3.4. Prefer bounded patch ranges within each existing major; PostCSS must also meet Vite 8.3.2's `^8.5.28`, not merely the advisory's 8.5.23 floor.
- Reconcile the optional PostCSS peer snapshots in the regenerated graph. Confirm tsup can still load and process CSS when explicitly supplied a PostCSS configuration, rather than relying only on this TypeScript CLI build.
- Keep the existing direct dependencies, Vitest 5 runner patch, test configuration and release thresholds.

## Acceptance criteria

- [ ] A fresh frozen installation succeeds with one valid CLI lockfile.
- [ ] Full and production audits are recorded separately. None of the 12 high development advisories from #469 remains.
- [ ] The Browserslist refresh removes the baseline-browser-mapping advisory; no unnecessary override is added for its data package.
- [ ] Production `fast-uri`, `qs` and `esbuild` are not changed or silently suppressed as part of this task.
- [ ] Typecheck, lint, CLI tests/coverage, build/bundle gate, mutation canary and the affected mutation scopes pass with unchanged thresholds.
- [ ] Windows CI and the focused tsup/PostCSS peer-loading check pass on the delivered graph.
- [ ] The PR targets `next`, reports remaining advisories and explains any additional transitive version or peer-snapshot changes.

## Prior art and evidence

[#469](https://github.com/ai-driven-dev/framework/issues/469) owns the discovery, not the dependency changes. The isolated six-version experiment passed 7,002 tests with one skipped, typecheck, a 750.7/751 KB build, four canary mutants and 39 authentication mutants. Development-only advisories fell from 18 to three, all high findings removed. Browser data refreshed within Browserslist's declared dependency ranges.

The complete package/advisory enumeration and compatibility limits are in [the audit](audit.md) and [findings](findings.json). The temporary experiment has not been copied into the discovery branch. The implementation must rerun its release gates on the delivered graph; the experiment alone does not establish all-platform compatibility.

## Out of scope

`qs` 6.16.0 conflicts with typed-rest-client 2.3.1's exact dependency pin. `esbuild` 0.28.1 falls outside tsup 8.5.1's current dependency range. Neither is included without separate compatibility evidence. The newer production `fast-uri` advisory also needs separate remediation. No Vitest, Stryker or tsup major migration, no advisory suppression and no threshold reduction.
