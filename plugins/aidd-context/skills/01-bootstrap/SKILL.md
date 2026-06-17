---
name: 01-bootstrap
description: Imagine, validate, then stand up a new project. First designs the technical architecture - checks the PRD, gathers technical needs, chooses & audits the stack - into a validated `INSTALL.md` + `README.md`; then materializes that `INSTALL.md` into a running, proven skeleton via atomic `init-*` actions (architecture, dependencies, env, database, quality gate, tests, containers, design system, CI). Stack-agnostic - every build action reads `INSTALL.md` and names no technology. Architecture-100% / business-0%: never writes business logic. Use when starting a new project, choosing a stack, or standing up the running skeleton. Do NOT use to add features to an existing project or to write business logic.
---

# Bootstrap

Technical architect **and** builder for a new project. Two phases. **Design** (01-04): check the PRD, gather technical needs, choose & audit the stack, write a validated `INSTALL.md` + `README.md`. **Build** (05-13): materialize that validated `INSTALL.md` into a running, proven skeleton through atomic, stack-agnostic `init-*` actions. Architecture-100% / business-0% - never writes business logic (per the firewall in `docs/ARCHITECTURE.md`).

## Available actions

**Design phase** - produces the validated `INSTALL.md` (docs only):

| #   | Action            | Role                                                                          | Input              |
| --- | ----------------- | ----------------------------------------------------------------------------- | ------------------ |
| 01  | `check-prd`       | Verify a PRD exists; if not, stop and ask the user to create one              | project            |
| 02  | `gather-needs`    | Ask the technical questions; product facts come from the PRD                  | PRD                |
| 03  | `choose-stack`    | Propose 2-3 candidates + audit (parallel) + user picks + architecture pattern | needs              |
| 04  | `init-install-md` | Write `INSTALL.md` + project-root `README.md`. **INSTALL.md is born here.**   | chosen stack       |

**Build phase** - materializes the validated `INSTALL.md` into a running skeleton. `05`-`06` read `INSTALL.md` (design → code); each later action builds on the previous one's output - the materialized project, where the stack is already concrete. No action names a technology; each has its own gate:

| #   | Action               | Role                                                                  | Delegate          |
| --- | -------------------- | --------------------------------------------------------------------- | ----------------- |
| 05  | `init-architecture`  | Folder tree + reachable route stubs from `INSTALL.md`'s pattern       | owns              |
| 06  | `init-dependencies`  | Dependency manager + building blocks (swappable) + boot               | owns              |
| 07  | `init-env`           | `.env.example` + config loading                                       | owns              |
| 08  | `init-database`      | Engine + baseline migration + fixtures + round-trip *(conditional)*   | owns              |
| 09  | `init-quality-gate`  | typecheck + format + lint + commit-linter + pre-commit (one gate)     | owns              |
| 10  | `init-tests`         | Runner + 1 unit + 1 e2e + coverage                                    | testing capability |
| 11  | `init-containers`    | Container/compose ups & downs clean *(conditional)*                   | owns              |
| 12  | `init-design-system` | Design system *(front-only, conditional)*                             | design-system capability |
| 13  | `init-ci`            | Pipeline runs the quality gate + tests, green on the server *(conditional)* | owns              |

## Default flow

**Design** `01 → 02 → 03 → 04`, then **Build** `05 → 06 → 07 → 08 → 09 → 10 → 11 → 12 → 13`. Sequential. `01-check-prd` is a hard gate: no PRD → stop. The audit inside `03` is a gate: if every candidate is `❌`, revise candidates and re-audit. **No build action runs until `INSTALL.md` is written and validated** (end of `04`). Conditional build actions (08, 11, 12, 13) skip when the project does not call for them. Each build action advances only when its own `## Test` gate is green.

## Transversal rules

- **PRD first.** `01-check-prd` halts the whole skill when no PRD exists - bootstrap never starts without product context.
- **Design before build; never fabricate.** No build action (05+) runs until the human has validated `INSTALL.md`. The design phase invents nothing - it waits for the human at every gate.
- **Architecture-100% / business-0%.** The build phase materializes a *validated* `INSTALL.md` - structure, building blocks, tooling, smoke tests - but never business logic (auth, domain rules, real features). Per the firewall in `docs/ARCHITECTURE.md`.
- **Stack-agnostic build.** No `init-*` action names a technology of its own. The stack comes from `INSTALL.md` (read by `05`-`06`) and from the materialized project thereafter - never from the action prompt.
- **Delegate, don't reinvent.** `init-tests` and `init-design-system` delegate to the capability that owns them (discovered by description, never a hardcoded plugin name).
- **Anti-sycophancy.** When a user stack preference conflicts with the needs (e.g. wants Mongo for heavily relational data), challenge before accepting: surface the audit concerns, ask for a mitigation plan.
- **Recommend opinionated, not encyclopedic.** Propose 2-3 options max, never a long catalog. The user leaves with a concrete decision, not a research paper.
- **Apply heuristics from `@references/stack-heuristics.md`** when proposing candidates.

## References

- `@references/checklist.md` - the needs checklist walked in `02-gather-needs`
- `@references/stack-heuristics.md` - input → recommended-stack-family heuristics

## Assets

- `@assets/INSTALL.md` - the `INSTALL.md` skeleton
- `@assets/README.md` - the project-root `README.md` template

## External data

- `aidd-context/skills/09-mermaid/SKILL.md` - invoked from `03-choose-stack` to render the architecture diagram
