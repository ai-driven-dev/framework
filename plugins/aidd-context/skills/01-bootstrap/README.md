← [aidd-framework](../../../../README.md) / [aidd-context](../../README.md)

# 01 - Bootstrap

Technical architect **and** builder for a new project. **Design** (actions 01-04): check the PRD, gather technical needs, choose & audit the stack, and produce a validated project-root `INSTALL.md` + `README.md`. **Build** (actions 05-13): materialize that validated `INSTALL.md` into a running, proven skeleton through atomic, stack-agnostic `init-*` actions. Architecture-100% / business-0% - never writes business logic (per the firewall in `docs/ARCHITECTURE.md`).

## When to use

- Starting a brand-new project and choosing a stack.
- Deciding the architecture pattern (monolith vs microservices vs serverless).
- Standing up the running skeleton from a fresh idea.

## When NOT to use

- Editing an existing project's stack (the audit is too heavy for one swap-out).
- Database schema design or detailed data modeling.
- Writing business logic (auth, domain rules, features).

## How to invoke

```
Use skill aidd-context:01-bootstrap
```

### Design phase → validated `INSTALL.md`

1. `check-prd` - verify a PRD exists; if not, stop and ask the user to create one (bootstrap can't start without it).
2. `gather-needs` - ask the technical questions; product facts come from the PRD.
3. `choose-stack` - propose 2-3 candidate stacks, audit each in parallel, user picks the winner, settle the architecture pattern + Mermaid diagram.
4. `init-install-md` - write the project-root `INSTALL.md` + `README.md`. **`INSTALL.md` is born here.**

### Build phase → running skeleton

No build action runs until `INSTALL.md` is written and validated; conditional actions skip per `INSTALL.md`.

5. `init-architecture` - folder tree + reachable route stubs from the chosen pattern.
6. `init-dependencies` - dependency manager + building blocks (swappable) + boot.
7. `init-env` - `.env.example` + config loading.
8. `init-database` - engine + baseline migration + seed fixtures + round-trip *(conditional)*.
9. `init-quality-gate` - typecheck + format + lint + commit-linter + pre-commit (one gate).
10. `init-tests` - runner + unit + e2e + coverage *(delegated)*.
11. `init-containers` - container ups & downs cleanly *(conditional)*.
12. `init-design-system` - design system *(front-only, delegated)*.
13. `init-ci` - pipeline runs the quality gate + tests, green on the server *(conditional)*.

## Outputs

- A validated project-root `INSTALL.md` + `README.md`, then a running skeleton proven by each build action's gate.

## Prerequisites

- A PRD / product brief (required - `check-prd` halts without it).
- A working directory.

## Technical details

See [`SKILL.md`](SKILL.md) for the action contract, [`actions/`](actions/) for each step, `references/stack-heuristics.md`, and `assets/`. The Mermaid diagram (action 03) renders via the sibling `09-mermaid` skill; `init-tests` and `init-design-system` delegate to the capability that owns them, discovered by description.
