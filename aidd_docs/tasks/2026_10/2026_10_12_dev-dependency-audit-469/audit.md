# Development dependency audit, issue #469

## Result

Measured on `next` commit `3e67f6f594b7b7f6cc7bceb0581ad6d515519080`, 12 October 2026, with pnpm 12.3.4. Full audit: 19 advisories, comprising 12 high, six moderate and one low. Production audit: one moderate advisory. Subtracting production advisory IDs leaves 18 development-only advisories: 12 high, five moderate and one low. No critical finding.

The development findings affect nine transitive packages. Vitest, its mocker, Vite and Babel core are no longer reported. No test-framework migration is required by this audit.

The machine-readable [findings](findings.json) record every advisory, resolved version, patched range, scope and a shortest dependency-path witness for each direct dependency that reaches it. Shared production/development findings are classified as production, never counted twice.

## Reproduction and prerequisites

- [#795](https://github.com/ai-driven-dev/framework/pull/795) was merged into `next`. A new isolated checkout successfully installed with `cd cli && pnpm install --frozen-lockfile`; neither the lockfile nor the dependency declarations changed. This establishes a usable, reproducible graph rather than auditing the historical invalid YAML.
- [#463](https://github.com/ai-driven-dev/framework/issues/463) is completed. Its six original high-severity `fast-uri` advisories are absent. A different, newer moderate advisory remains and is listed separately below.
- `cd cli && pnpm audit --prod --json` and `cd cli && pnpm audit --json` both exit 1 because findings remain, not because the audit request failed. Both outputs contain complete advisory and metadata objects.
- Baseline `cd cli && pnpm build` passes: 750.7 KB within the unchanged 751 KB budget.

To reproduce the subtraction, compare advisory IDs in the full and production JSON outputs. A package name alone is insufficient because a dependency can be shared by runtime and tooling.

## Dependency paths and remediation

Every package below is absent from the production audit. These dependencies execute on developer machines and CI. Their presence does not prove that this project's configuration reaches each vulnerable operation. The paths establish installation and tooling exposure; the conditions describe when exploitation would become relevant.

| Package, resolved version | Advisory counts | Representative dependency path | Smallest candidate and constraint |
| --- | --- | --- | --- |
| `brace-expansion` 5.0.6 | Five high, one moderate | Stryker core → minimatch → brace-expansion | 5.0.12 clears all six, within minimatch's `^5.0.2`. |
| `postcss` 8.5.15 | One high, one moderate | Vitest → Vite → postcss; tsup → postcss | Advisory floor is 8.5.23; use 8.5.28 to also satisfy Vite 8.3.2's `^8.5.28`. The current global override bypasses that parent requirement. |
| `nanoid` 3.3.12 | Two high | Vitest → Vite → postcss → nanoid; tsup → postcss → nanoid | 3.3.18 clears both, within postcss's `^3.3.12`. |
| `browserslist` 4.28.2 | Two high | Stryker core → instrumenter → Babel → helper-compilation-targets → browserslist | 4.28.7, within Babel's `^4.24.0`. |
| `js-yaml` 4.3.1 | One high | Commitlint CLI → load → cosmiconfig → js-yaml | 4.3.2, within cosmiconfig's `^4.1.0`. |
| `source-map-js` 1.2.1 | One high | Vitest coverage → magicast → source-map-js; postcss → source-map-js | 1.2.2, within both parents' `^1.2.1`. |
| `baseline-browser-mapping` 2.10.27 | One moderate | Stryker → Babel → browserslist → baseline-browser-mapping | 2.11.0 is the advisory floor and fits `^2.10.12`; first check whether the browserslist refresh already removes it. |
| `qs` 6.15.2 | Two moderate | Stryker core → typed-rest-client → qs | 6.16.0 is patched, but typed-rest-client 2.3.1 pins 6.15.1. The existing override already bypasses that pin. Compatibility of another forced version is not established here. Latest typed-rest-client 3.1.2 declares `^6.16.0`, but upgrading that parent would be a separate major migration. |
| `esbuild` 0.27.3 | One low | tsup → esbuild; Vitest → Vite → esbuild | 0.28.1 is patched. Vite's peer permits 0.28, but current/latest tsup 8.5.1 requires `^0.27.0`. Do not force the minor transition under tsup without separate compatibility evidence. |

### Exploit conditions

- Brace expansion findings concern crafted patterns consuming CPU, memory or stack. Stryker selects mutation files with glob patterns; the audit does not establish attacker-controlled pattern input in the current configuration.
- Browserslist findings concern memory exhaustion from distinct queries and a crash/prototype write from a hostile [custom statistics file](https://github.com/advisories/GHSA-73wf-gq98-2v4g). Here it is a Babel/Stryker dependency, outside the shipped CLI runtime.
- Nanoid findings concern invalid generator sizes. Postcss consumes it to generate IDs; the installed path alone does not establish propagation of an attacker-controlled size.
- Postcss findings concern automatic loading of source maps from attacker-influenced CSS. The build entry point is TypeScript, with no declared CSS entry. Tooling remains exposed if such input is introduced.
- The [source-map-js advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) concerns indexed source maps with malicious offsets; coverage and CSS tooling consume source maps during development.
- The [js-yaml advisory](https://github.com/advisories/GHSA-2883-xcg3-v3hh) concerns excessive merge processing. Commitlint's configuration loader can parse YAML from the checkout; the repository currently supplies a JavaScript commitlint configuration.
- The [baseline-browser-mapping advisory](https://github.com/advisories/GHSA-w5vr-8v7q-w6rv) concerns process termination on invalid input, through the development-only Browserslist path.
- One [qs advisory](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx) concerns a parser-limit bypass. The [other](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g) concerns a TypeError during serialization of attacker-influenced `constructor.isBuffer` values. The installed consumer is Stryker's HTTP client; no CLI runtime path is present in the production audit.
- The [esbuild advisory](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr) requires esbuild's file-serving development server on Windows. The reviewed tsup configuration builds a CLI bundle and does not enable that server. This bounds observed reachability, without declaring the installed version safe for every developer use.

## Separate production finding

[GHSA-hrr3-gc8f-f4qj](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj), moderate, affects `fast-uri` 3.1.7 through runtime `ajv` and `ajv-formats → ajv`. Commitlint and Stryker also reach the same package. The patched v3 floor is 3.1.8; Ajv requires `^3.0.1` and the current override is `>=3.1.6 <4`.

This newer host-normalization finding is not one of the six advisories resolved by #463. It belongs to a separate production remediation. The CLI's manifest validation does not by itself demonstrate an SSRF path.

## Compatibility experiment and decision

Six exact development-only patch candidates were tested in a separate detached checkout: brace-expansion 5.0.12, browserslist 4.28.7, js-yaml 4.3.2, nanoid 3.3.18, postcss 8.5.28 and source-map-js 1.2.2. No experiment dependency change belongs to this discovery branch.

The experiment uses macOS, Node 26.8.2 and pnpm 12.3.4. Registry lookups confirmed that all six versions exist and satisfy their parents' declared ranges. Results on the actual regenerated graph:

- Fresh installation, followed by a frozen installation: passed. Only the isolated CLI workspace settings and lockfile differ; direct dependencies, root lockfile and test configuration are unchanged.
- `cd cli && pnpm test`: 7,002 passed, one skipped, 539 files passed and one skipped.
- `cd cli && pnpm typecheck` and `pnpm build`: passed; bundle remains 750.7 KB within 751 KB.
- `cd cli && pnpm test:mutation:canary`: four mutants killed, score/floor 100, exact covering-test selection passes.
- `cd cli && pnpm exec stryker run --mutate src/runtime/auth/gh-token-adapter.ts`: all 39 mutants killed.
- Full audit falls from 19 to four advisories. Production remains one moderate `fast-uri` advisory. Development-only findings fall from 18 to three: two moderate `qs` findings and one low `esbuild` finding. All 12 high findings are removed.
- Updating Browserslist also resolves baseline-browser-mapping 2.11.28, clearing its moderate advisory without an additional override. Its browser-data dependencies refresh within their declared ranges.

pnpm rewrites optional-peer snapshots for tsup and postcss-load-config; they no longer carry optional PostCSS peers, while Vite retains PostCSS 8.5.28. A focused comparison ran both installed pnpm tsup commands on the same external TypeScript/CSS fixture with an explicit PostCSS configuration. Its inline plugin added an observable CSS marker and the executing PostCSS version. Both builds passed: baseline used 8.5.15 and candidate used 8.5.28. No inherited `NODE_PATH` was supplied; the installed pnpm command's own resolution still finds PostCSS. No additional direct dependency is needed for this measured CLI path.

The CLI build, end-to-end suite and focused CSS configuration probe pass. This does not prove every programmatic tsup integration, Windows/Linux or full mutation-scope compatibility. Those release checks remain for the separate implementation.

The proven follow-up is [#1008](https://github.com/ai-driven-dev/framework/issues/1008), the [six-package remediation task](follow-up.md), published as a Task with Priority High and status Todo in AIDD Roadmap. Keep `qs`, `esbuild` and production `fast-uri` outside that task. No forced parent major upgrade, advisory suppression, or test/bundle threshold change is justified by this audit. No dependency upgrade is delivered by #469.

## Acceptance status

- Production prerequisite: passed for the original six #463 advisories; the newer moderate finding is distinguished above.
- Lockfile prerequisite and fresh-install reproduction: passed.
- Every remaining advisory classified by dependency path and production/development scope: passed, with complete enumeration in findings.json.
- Proven remediation and follow-up task: passed; compatibility demonstrated and task #1008 published.
