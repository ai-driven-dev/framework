# 07 - Design System

Guided onboarding for authoring a **quality design system**, wrapping the [Impeccable](https://impeccable.style) skill. Impeccable does the work (palette, typography, tokens, `DESIGN.md`); this skill adds the ordered playbook so no essential step is skipped. It writes **no design files of its own** - Impeccable's `DESIGN.md` stays canonical.

## Usage

```
/aidd-context:12-design-system
```

Manual only. Two actions, both Impeccable runbooks with per-step checkboxes:

- `01-create-design-system` - setup: `init` -> `document` -> `extract` -> refine -> `audit`/`critique`.
- `02-redesign-page` - improve an existing page. The AI invokes every Impeccable command itself; the user only answers questions and validates: `critique` (baseline score) -> ask what hurts -> axis commands (`layout`/`typeset`/`colorize`/`bolder`/`quieter`/`distill`/`animate`) -> show & validate -> `polish`/`audit`/re-`critique`, looping until no P0/P1 and the score beats the baseline. New patterns fold back via `extract`.

## Requires

The **Impeccable** skill (the playbook checks and guides install if missing).

## Not for

Authoring **new** page or component code - that is an implementation concern (Execution layer), where the implementer delegates the visual to Impeccable against this `DESIGN.md`. This skill founds the system and routes redesigns; Impeccable does the work and `DESIGN.md` stays canonical.
