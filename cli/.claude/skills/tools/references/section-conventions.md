# Reference: Section Conventions

A section is one part a profile declares (`ProfileSections` in `domain/profile.ts`: agents, skills, commands, rules, mcp, hooks, layout, manifest, config; layout is a union, see `plugin-sections.md`). Its class is internal to `tools`. A caller never imports one, guards its presence or reads its fields: it asks the profile a question, and the answer is a method of `contract/tool-profile.ts` (`markdownSection("rules")`, `mcpConfig()`, `settingsFiles()`). A new answer is a method there, implemented over the section.

## Class shape

One class per file in `domain/sections/`, named `<kebab-name>-section.ts`, class name ending in `Section` (`SkillsSection`).

```typescript
type WidgetsSectionParams = {
  directory?: string; // optional: has a default
  maxWidgets: number; // required
};

export class WidgetsSection {
  readonly #params: WidgetsSectionParams;

  constructor(params: WidgetsSectionParams) {
    if (params.maxWidgets <= 0) {
      throw new CapabilityConfigError("WidgetsSection: maxWidgets must be > 0");
    }
    this.#params = params;
  }

  outputPath(name: string): string {
    return `${this.#params.directory ?? DEFAULT_DIR}${name}`;
  }
}
```

## Required invariants

- The constructor takes exactly one params object, never positional arguments.
- State is private (`#params`) and read through methods: a field is not part of the surface.
- Throw `CapabilityConfigError` (from `kernel/errors.ts`) on an invalid param combination.
- The class models what the tool declares, not decisions: a method is a path builder, a resolver or a predicate, short and without side effects.
- It imports only `kernel/` and sibling folders of `domain/` (`formats/`, `profile/`).
- A profile declares a section only when the tool has it. A missing section is a missing declaration.
