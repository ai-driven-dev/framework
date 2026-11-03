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

### Phase 2: Access check skill (reworked 2026-10-20)

- [x] Verification leaves `02-project-memory`, back to `origin/next`; it lives in `13-access-check`, read-only, one row per `Agent` edge of `ecosystem.md`: `13-access-check/actions/01-check.md`, `13-access-check/assets/access-report.md`.
- [x] No memory proposes `/aidd-context:02-project-memory`, never runs it; onboarding offers the check as the last foundation of a setup session: `00-onboard/references/state/zones.md`.

### Phase 3: Validator support

- [x] CLI validation permits H4 subsections only below a direct numbered H3 step; malformed numbered headings still fail; unit cases cover valid subsections, orphans, changed parents and malformed headings: `recipe-validation.ts:397–439`, `recipe-validation.unit.test.ts:120–155`.

## Findings

None.

## Review of 2026-10-15

| # | Finding | Resolution |
| --- | --- | --- |
| 1 | `02-project-memory` does too much | verification moved to `13-access-check` |
| 2 | the action resolves the recipe by relative path | the skill reads memory only, no recipe |
| 3 | four options announced, two shown | recipe step 2 shows CLI, MCP, API and SDK |
| 4 | examples cover Claude Code only | one example plus a table of five clients' MCP guides; the former recipe named no other client either |
| 5 | the GitHub API example contradicts CLI-first | replaced by an internal API with no CLI or MCP |
| 6 | why generate a skill for an API | the recipe says to run `/aidd-context:04-skill-generate` from the API when no CLI or MCP exists |
| 7 | no link to project memory | the intro names `ecosystem.md` and `/aidd-context:02-project-memory` |
| 8 | nothing on errors | ❌ with one corrective action, next row still probed; missing memory stops with a proposal |
| 9 | the description loses its meaning | `02-project-memory` description restored |
| 10 | `check` beside `verify` is confusing | `verify` left the skill |
| 11 | "report of what changed" does not fit verify | rule untouched, verify left the skill |

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
| Non-blocking clarity | resolved 2026-10-20: the access check reads memory only, no recipe resolution remains |
| Non-blocking router consistency | resolved 2026-10-20: verify left `02-project-memory`, its report rule fits every entry again |
