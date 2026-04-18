# Decision: requiredIdeId on ConfigRef for IDE-conditional distribution

| Field   | Value                            |
| ------- | -------------------------------- |
| ID      | DEC-026                          |
| Date    | 2026-04-18                       |
| Feature | IDE-aware copilot settings       |
| Status  | Accepted                         |

## Context

GitHub Copilot is IDE-agnostic (VS Code, JetBrains, Xcode, Neovim, etc.). Installing copilot alone should not generate `.vscode/settings.json`. The conditional logic needed to know which IDE tools are active at install time without coupling tool configs to the manifest or to each other.

## Decision

Add optional `requiredIdeId?: IdeToolId` to `ConfigRef`. A config ref with `requiredIdeId: "vscode"` is only included in a tool's generated distribution when `"vscode"` is present in the `ideContext` (union of selected IDE tools + already-installed IDE tools from manifest). The filtering happens post-generation via `filterGeneratedFilesByIdeContext()` in `src/domain/models/config-ref-filter.ts`, called from `InstallUseCase` and `UpdateUseCase`.

## Alternatives Considered

| Alternative | Pros | Cons | Rejected because |
| --- | --- | --- | --- |
| Conditional in `ConfigHandler.outputPath()` | Co-located with tool config | Port has no access to manifest/selection | Domain layer cannot read application state |
| Separate install step per IDE combo | Explicit | Combinatorial explosion as IDEs grow | Doesn't scale |

## Consequences

- `ConfigRef` is the single declaration point for IDE dependencies
- `filterGeneratedFilesByIdeContext()` is a pure function reused by install and update
- Interactive install prompts user to add vscode if copilot is selected without an IDE
- Adding a new IDE tool (IntelliJ) requires only a new `requiredIdeId` value — no use-case changes
