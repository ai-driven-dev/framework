# AGENTS COORDINATION

| AGENT NAME | ROLE DESCRIPTION                                                                   | RESPONSIBILITIES                                                                                                                        | STATUS |
| ---------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `alexia`   | Autonomous end-to-end feature implementation without human intervention             | - Implement features end-to-end without asking questions <br> - Make all implementation decisions autonomously based on project rules    | prod   |
| `claire`   | Product Discovery — clarifies fuzzy ideas into actionable briefs                    | - Transform fuzzy ideas via Brain Dump → Brief → Research → Prompt Package <br> - Clarify ambiguities at any project stage              | prod   |
| `oriane`   | PM Orchestrator — orchestrates all product workflows                   | - Run PM skills sequentially with challenge gates <br> - Adapt flow based on existing deliverables and user request                  | prod   |
| `ariane`   | Architect — handles technical architecture and implementation planning            | - Make justified architecture decisions from PRD and constraints <br> - Create implementation plans                                      | prod   |
| `diane`    | UX Designer — handles design systems, user flows, accessibility, UX copy          | - Create and maintain design systems <br> - Map user flows, spec accessibility, write UX copy, audit UX                                 | prod   |
| `eva`      | Impact Evaluator — evaluates impacts of ideas, decisions, and deliverables globally | - Assess impacts across 5 dimensions (technical, business, users, regulatory, operational) <br> - Provide structured impact reports     | prod   |
| `justine`  | Challenger — challenges ideas, decisions, and deliverables using structured methods | - Challenge whatever is put in front of her using structured methods <br> - Block progression until all critical gaps are resolved        | prod   |
| `kent`     | TDD & Tidy First development guide                                                 | - Drive the Red → Green → Refactor TDD cycle <br> - Separate structural changes from behavioral changes                                | prod   |
| `iris`     | Frontend specialist - implement from Figma, verify UI conformity, validate journeys | - Implement components from Figma designs <br> - Verify UI conformity and validate user journeys                                        | prod   |
| `martin`   | Code quality and validation agent                                                  | - Run commands to validate build, lint and tests <br> - Enforce coding assertions and module-specific rules                             | prod   |

## Communication flow (if applicable)

<!-- To coordinate effectively, agents will follow this communication flow IF they depend on each other: -->

```mermaid
---
title: Agent Communication Flow
---
flowchart LR
    "claire" -->|"structured brief"| "oriane"
    "oriane" -->|"PM deliverables"| "ariane"
    "oriane" -->|"PM deliverables"| "diane"
    "oriane" -->|"challenge"| "justine"
    "oriane" -->|"evaluate impact"| "eva"
    "ariane" -->|"challenge"| "justine"
    "ariane" -->|"evaluate impact"| "eva"
    "diane" -->|"challenge"| "justine"
    "diane" -->|"evaluate impact"| "eva"
    "ariane" -->|"implementation"| "alexia"
    "ariane" -->|"TDD"| "kent"
    "alexia" -->|"implementation"| "martin"
    "alexia" -->|"frontend"| "iris"
    "kent" -->|"code to validate"| "martin"
    "iris" -->|"validated UI"| "martin"
```

## Usage

### `alexia`

> Use Alexia when you want a fully autonomous senior engineer to implement a feature or fix end-to-end without questions.

Use-cases :

- **Autonomous feature delivery** : Implement a complete feature from request to final report with minimal human interaction.
- **Exploratory implementation** : Try a pragmatic implementation path quickly while respecting project rules and best practices.

### `claire`

> Use Claire when you have a fuzzy idea and need to structure it into an actionable brief.

Use-cases :

- **Fuzzy ideas** : Transform vague ideas via Brain Dump → Brief → Research → Prompt Package.
- **Clarification** : Clarify ambiguous requirements at any stage of a project.
- **Discovery phase** : Conduct market research and generate personas from data.

### `oriane`

> Use Oriane when you need to orchestrate a full product workflow (greenfield or brownfield).

Use-cases :

- **Greenfield projects** : Run the full Constitution → Discovery → PRD → User Stories pipeline.
- **Brownfield evolution** : Run the System Overview → Change Brief → Change Spec pipeline.
- **Adaptive** : Oriane detects existing deliverables, skips completed steps, and adapts to the user's request.
- **Skills** : `pm-constitution`, `pm-product-brief`, `pm-prd`, `pm-user-stories`, `pm-system-overview`, `pm-change-brief`, `pm-change-spec`.

### `ariane`

> Use Ariane when you need technical architecture decisions or implementation planning.

Use-cases :

- **Greenfield architecture** : Run Architecture Decision → Extract Milestones pipeline.
- **Brownfield architecture** : Run Architecture Impact → Impact Plan pipeline.
- **Technical decisions** : Make justified architecture decisions linked to functional requirements.
- **Skills** : `architecture-decision`, `architecture-milestones`, `architecture-impact`, `architecture-impact-plan`.

### `diane`

> Use Diane when you need design system creation, user flow mapping, accessibility specs, UX copy, or UX audits.

Use-cases :

- **Design system** : Create or update the design system from PRD user journeys.
- **User flows** : Map complete user flows with all states (happy, error, empty, loading, permission, offline, first-time).
- **Accessibility** : Generate actionable a11y specifications per component.
- **UX copy** : Generate i18n-ready microcopy for the entire product.
- **UX audit** : Evaluate an existing product against Nielsen's 10 heuristics.
- **Skills** : `ux-design-system`, `ux-design-system-update`, `ux-flow-map`, `ux-flow-update`, `ux-accessibility`, `ux-accessibility-update`, `ux-copywriting`, `ux-copywriting-update`, `ux-audit`.

### `eva`

> Use Éva when you need to evaluate the global impact of whatever is in front of you — ideas, decisions, deliverables, changes.

Use-cases :

- **Impact assessment** : Evaluate impacts across 5 dimensions (technical, business, users, regulatory, operational).
- **Alternative comparison** : Compare multiple approaches with a structured impact matrix.
- **Decision support** : Get a GO / GO with mitigations / NO-GO recommendation.
- **Skills** : None (standalone evaluation service callable by oriane, ariane, diane, or any user).

### `justine`

> Use Justine when you need to challenge anything — ideas, decisions, deliverables, scope, trade-offs.

Use-cases :

- **Deliverable review** : Challenge any deliverable for completeness, contradictions, and missing elements.
- **Idea/decision challenge** : Question assumptions, scope decisions, trade-offs before committing.
- **Gap analysis** : Identify cross-document inconsistencies and missing references across the full workflow.

### `kent`

> Use Kent when you explicitly want strict Test-Driven Development and Tidy First refactoring discipline.

Use-cases :

- **New critical logic** : Design and implement core domain behavior with a tight Red → Green → Refactor loop.
- **Huge or risky refactors** : Separate structural from behavioral changes and validate each step with tests.

### `iris`

> Use Iris every time you need to verify or review a frontend implementation against initial requirements.

Use-cases :

- **Frontend implementation** : Generate components from Figma designs with exact values (colors, spacing, typography).
- **UI validation** : Verify that a frontend implementation fully conforms to the original design or requirements.
- **User journey testing** : Validate complete user flows and interactions step by step.

### `martin`

> Use Martin every time you need to ensure the codebase still builds correctly and all tests and coding rules pass.

Use-cases :

- **Build validation** : Verify that the project compiles and all tests pass after changes.
- **Code quality enforcement** : Apply coding assertions and module-specific rules to ensure high-quality code.
