# Decision: IdePatchUseCase for late IDE installation

| Field   | Value                              |
| ------- | ---------------------------------- |
| ID      | DEC-030                            |
| Date    | 2026-04-20                         |
| Feature | IDE context patch on install       |
| Status  | Accepted                           |

## Context

When a user installs copilot first (no IDE), the IDE-conditional files are skipped. If they later run `aidd install vscode`, the copilot IDE-conditional files (e.g. `copilot-settings.json`) would never be distributed without an explicit re-install of copilot.

## Decision

`IdePatchUseCase` in `src/application/use-cases/shared/` runs at the end of `installAllTools` for any newly installed IDE tools. It finds installed AI tools whose `requiredIdeIds` intersect the new IDE tools, then distributes their IDE-conditional config files using the same framework descriptor and content files as the main install.

## Alternatives Considered

| Alternative | Pros | Cons | Rejected because |
| --- | --- | --- | --- |
| Require user to re-install AI tools | No extra code | Poor UX; user doesn't know they need to | Unacceptable friction |
| Patch inside `installOneTool` for IDE tools | Co-located | Inverts dependency; IDE tool knows about AI tools | Wrong direction of knowledge |

## Consequences

- Installing an IDE retroactively completes AI tool setup transparently
- `IdePatchUseCase` lives in `shared/`; called only from `InstallUseCase`, never from commands
- `patchAlreadyInstalledAiTools()` private method in `InstallUseCase` extracts the IDE-filter + execute call
- Update path (`UpdateUseCase`) does not need a patch — full distribution runs on update
