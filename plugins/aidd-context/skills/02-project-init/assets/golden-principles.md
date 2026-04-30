# Golden Principles (Agent Guidelines)

Rules the agent MUST NOT bypass.

---

- [🏗️ Architecture \& Structure](#️-architecture--structure)
- [🔄 Boundaries \& I/O](#-boundaries--io)
- [🛠 ️ Shared Utilities](#-️-shared-utilities)
- [🛡️ Data Safety](#️-data-safety)
- [🧑‍💻 Coding](#-coding)
- [🎯 Simplicity \& Scope](#-simplicity--scope)
- [⚠️ Errors \& Observability](#️-errors--observability)
- [🔄 Refactoring Rules](#-refactoring-rules)
- [🧪 Testing Rules](#-testing-rules)
- [🛠 ️ Tooling Preference](#-️-tooling-preference)

---

## 🏗️ Architecture & Structure

- Use business domains as top-level folders.
- Use descriptive paths. Avoid generic buckets.
- Keep one responsibility per file.
- Dependencies flow one way: higher → lower.

## 🔄 Boundaries & I/O

- UI/controllers never do I/O.
- Keep external I/O in adapters (repo/connectors).
- Keep business rules in services/use-cases.
- Split modules when behavior diverges.

## 🛠 ️ Shared Utilities

- Reuse shared utilities before writing new helpers.
- If code is used twice, centralize it.
- Keep invariants in one place (errors, logging, time, retry).
- No local `utils/` or `helpers/` inside domains.
- No local variants of shared utils.

## 🛡️ Data Safety

- Validate/parse at every boundary.
- After parsing, use trusted shapes only.
- Never rely on guessed fields.
- Prefer generated clients or validated contracts.

## 🧑‍💻 Coding

- Prefer small, frequent cleanup PRs.

## 🎯 Simplicity & Scope

- Implement only the requested requirements.
- Do not add extra features.
- Prefer the simplest working design.
- Abstract only with reuse.
- Remove dead code and unused options.
- Never add features "just in case", or for "future use".

## ⚠️ Errors & Observability

- Fail fast on invalid state.
- Never ignore or swallow errors.
- Keep error mapping centralized.
- Write short, actionable errors, custom exceptions when needed.

## 🔄 Refactoring Rules

- Preserve behavior and intent.
- Make small, safe changes.
- Rename to clarify intent.
- Delete duplication before adding features.
- Comment only on tricky logic or constraints.

## 🧪 Testing Rules

- For bug fixes: write the test first.
- Test behavior, not implementation details.
- Do not mock business logic.
- Include edge cases and failure paths.
- Keep tests deterministic.

## 🛠 ️ Tooling Preference

- Prefer CLI tools over MCPs.
