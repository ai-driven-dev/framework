# Section conventions

A section is one part a profile declares; the keys are `ProfileSections` in `domain/profile.ts`. A caller never imports one, guards its presence or reads its fields: it asks the profile, and the answer is a method of `contract/tool-profile.ts`.

## Class shape

- One class per file in `domain/sections/`, named `<kebab-name>-section.ts`, class name ending in `Section` (`SkillsSection`).
- The constructor takes one params object, never positional arguments.
- State is private (`#params`) and read through methods.
- A method is a path builder, a resolver or a predicate: short, with no side effect.
- An invalid params combination throws `CapabilityConfigError` (`shared/domain/errors/capability-config-error.ts`), as `SkillsSection` does.

```typescript
export class WidgetsSection {
  readonly #params: WidgetsSectionParams;

  constructor(params: WidgetsSectionParams) {
    if (params.maxWidgets <= 0) throw new CapabilityConfigError("WidgetsSection: maxWidgets must be > 0");
    this.#params = params;
  }
}
```

## Exceptions

| Section | Shape |
| --- | --- |
| `layout`, `manifest` | plain data from `nativeLayout`, `flatPlacement` and `manifestSection`; see `plugin-sections.md` |
| `mcp`, `hooks` | parts and delivery types (`McpConfigPart`, `HooksConfigPart`, `HooksDelivery`) |

## Imports

- A section imports `shared/domain/`, `contract/` and sibling folders of `domain/`.
- A profile declares a section only when the tool has it.
