# 12 - Init design system

Establish the project's design system. Front-end only - skip when the project has no frontend. Delegates entirely; owns no design logic.

## Inputs

- Whether the project has a frontend (evident from the materialized project). The design system's content comes from the design tool.

## Process

1. If no frontend, skip and record why.
2. Otherwise delegate to the **design-system capability** (discovered by description; it routes to the design tool) to establish color strategy, typography, spacing, and tokens into the canonical design document.

## Test

- [ ] Frontend project: the design document exists (single source of truth).
- [ ] Backend-only project: explicitly skipped, with the reason recorded.
