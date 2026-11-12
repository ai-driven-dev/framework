# Reference: Capability Conventions

A capability is one section a profile declares (`ProfileSections` in `domain/profile/profile-sections.ts`: agents, skills, commands, rules, mcp, hooks, settings; plugins are a union, see `plugins-capability.md`). Its class is internal to `tools`. A caller never imports one, guards its presence or reads its fields: it asks the profile a question, and the answer is a method of `contract/tool-profile.ts` (`markdownSection("rules")`, `mcpConfig()`, `settingsFiles()`). A new answer is a method there, implemented over the capability.

## Class shape

One class per file in `domain/capabilities/`, named `<kebab-name>-capability.ts`, class name ending in `Capability` (`SkillsCapability`).

```typescript
type WidgetsCapabilityParams = {
  directory?: string; // optional: has a default
  maxWidgets: number; // required
};

export class WidgetsCapability {
  readonly #params: WidgetsCapabilityParams;

  constructor(params: WidgetsCapabilityParams) {
    if (params.maxWidgets <= 0) {
      throw new CapabilityConfigError("WidgetsCapability: maxWidgets must be > 0");
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
- A profile declares a capability only when the tool has it. A missing capability is a missing declaration.
