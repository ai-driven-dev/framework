# Review: Connect services

- **Verdict**: approve
- **Diff**: `origin/next...HEAD` plus tracked working edits to the recipe, verification action and report
- **Axes run**: code, functional, relevancy
- **Date**: 2026-10-14
- **Findings**: 0 critical, 0 warning, 0 minor; formal findings limited to concrete P0/P1 risks

## Phases

### Phase 1: Recipe and setup

- [x] Rename recipe and update its references: `README.md:239`, `token-optimization.md:452`, new `connect-services.md` replaces `mcp-installation.md`.
- [x] Eight actual H4 category headings with emojis: `connect-services.md:49–113`.
- [x] Service tables expose linked CLI, MCP/native and API/SDK alternatives; unsupported Google CLI labeled: `connect-services.md:53–122`.
- [x] Explain memory mapping and link category memory templates: `connect-services.md:5`, `connect-services.md:47–115`.
- [x] Three actionable steps; installation checks existing access, follows documentation, then authenticates; code examples belong to bullets: `connect-services.md:43`, `connect-services.md:125–165`.
- [x] Bold introductory labels use a colon; ordinary bullets avoid unnecessary labels: `connect-services.md:131`, `connect-services.md:138`, `connect-services.md:147`.

### Phase 2: Verification

- [x] Public `verify` entry routes to `verify-connection`: `02-project-memory/SKILL.md:4`, `02-project-memory/SKILL.md:14–15`, `02-project-memory/SKILL.md:29`.
- [x] Resolve the local recipe and read it by relative path; relevant memory is not a fixed filename list: `05-verify-connection.md:7`, `05-verify-connection.md:15–17`.
- [x] Simple map, read and report process; rules replace a terminal Test section; unavailable context never means not needed: `05-verify-connection.md:15–26`.
- [x] Read-only operation excludes writes, installs, login, memory changes and secret output; successful reads must match account and target: `05-verify-connection.md:25–26`.
- [x] One category per four-column report; aggregate status preserves failed or unverified required access: `connection-report.md:4–24`.

### Phase 3: Validator support

- [x] CLI validation permits H4 subsections only below a direct numbered H3 step; malformed numbered headings still fail; unit cases cover valid subsections, orphans, changed parents and malformed headings: `recipe-validation.ts:397–439`, `recipe-validation.unit.test.ts:120–155`.

## Findings

None.

## Verification

| Metric | Value |
| --- | --- |
| Verified | 100% (12/12) static acceptance criteria reviewed |
| Files checked | All 10 changed PR files: README, recipe validator, validator unit tests, context CATALOG, project-memory router, verification action, connection report, new connect-services recipe, deleted mcp-installation recipe, token-optimization recipe; three current tracked doc edits included |
| Static check | `git diff --check origin/next` exited 0; scoped README/plugins/CLI search found no old `mcp-installation` reference |
| Unchecked | Provider execution and runtime test results: not-applicable to this read-only static review; provider documentation contents and link availability not independently rechecked |
| Unplanned | None; validator relaxation directly supports requested H4 category structure |
| Completion score | 100: every supplied criterion examined |
| Quality score | 92: criteria statically fulfilled; small duplication and local catalogue resolution indirection remain; runtime/provider behavior is not established by this review |
| Non-blocking simplification | `connect-services.md:9–39`: graph shows a decision sequence, table shows tradeoffs; their functions differ, but graph repeats CLI preference and API fallback. Retaining just the comparison table and a short selection sentence would reduce page length without losing useful choice information |
| Non-blocking clarity | `05-verify-connection.md:15`: local recipe resolution has an existing authoritative location policy at `../../12-cook/references/recipe-locations.md`; linking that policy would remove ambiguity without duplicating it |
| Non-blocking router consistency | `02-project-memory/SKILL.md:36`: “report of what changed” predates the read-only verify entry; scoping it to setup/refresh/rewire would align it with verify's observed-results report |
