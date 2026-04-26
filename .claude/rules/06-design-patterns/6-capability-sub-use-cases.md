---
paths:
  - "src/application/use-cases/**/*.ts"
  - "src/domain/tools/**/*.ts"
---

# Capability Sub-Use-Cases

## Pattern

- Orchestrator use-case guards capability presence: `"agents" in caps`
- Matching sub-use-case receives a narrowed type: `AiTool<HasAgents>`
- Sub-use-case accesses the capability directly: `toolConfig.capabilities.agents`
- Sub-use-cases live in subdirs: `install/`, `update/`

## Capability guard

- Check `section.name in caps` before dispatching — skips tools that lack the capability
- Never access `caps.agents` without first confirming presence via the guard

## Sub-use-case contract

- Receives pre-filtered, pre-typed input — never raw `ToolConfig` or unnarrowed union
- Returns `InstallationFile[]` or typed result — no side effects, no I/O
- Single `execute()` method, same rules as all use-cases (≤ 20 lines per method)

## Canonical example

`GenerateToolDistributionUseCase` and `InstallUseCase.generateSectionFiles()` in `src/application/use-cases/`

## Forbidden

- No capability access without presence guard
- No sub-use-case logic inlined in orchestrator
- No sub-use-case called from commands
