# Reference: Capability Sub-Use-Cases

## Pattern

An orchestrator use-case guards capability presence before dispatching to a sub-use-case that receives a narrowed type.

## Capability guard

```typescript
if ("widgets" in caps) {
  const result = await new ApplyWidgetCapabilityUseCase(...).execute({ config: toolConfig as ToolConfig<HasWidgets> });
}
```

- Check `section.name in caps` before dispatching — skips tools that lack the capability
- Never access `caps.widgets` without first confirming presence via the guard

## Sub-use-case contract

- Receives pre-filtered, pre-typed input — never raw `ToolConfig` or unnarrowed union
- Returns `InstallationFile[]` or typed result — no side effects, no I/O
- Single `execute()` method, same rules as all use-cases (≤20 lines per method)

## Location

Sub-use-cases live in subdirectories of the parent feature: `install/`, `update/`

## Forbidden

- No capability access without presence guard
- No sub-use-case logic inlined in orchestrator
- No sub-use-case called from commands

## Sub-use-case agnostic shape

```typescript
// src/application/use-cases/apply/apply-widget-capability-use-case.ts
export class ApplyWidgetCapabilityUseCase {
  constructor(private readonly fs: FileWriter) {}

  async execute(options: ApplyWidgetCapabilityOptions): Promise<WidgetFile[]> {
    const { config } = options;
    // config is narrowed — caller already verified "widgets" in caps
    return this.buildWidgetFiles(config.widgets);
  }

  private buildWidgetFiles(widgets: WidgetList): WidgetFile[] {
    // ... ≤20 lines
  }
}
```
