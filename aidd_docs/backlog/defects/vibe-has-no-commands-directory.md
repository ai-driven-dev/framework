---
type: defect
status: reported
---

# Defect: The mistral profile writes commands to a directory Vibe never reads

## Context

`cli/src/contexts/tools/domain/profiles/mistral/profile.ts` declares a CommandsCapability installing to `.vibe/commands/` and sets `signalDir: ".vibe/commands"`. Its `rewriteContent` additionally rewrites command references to `.vibe/commands/<phase>/` while `buildInstallPath` flattens phase directories away, so the rewritten path is never the installed path (found in review, `review.md` warning, `profile.ts`).

## Expected

Command-like AIDD artifacts reach a surface Vibe actually reads, and content references point at paths that exist after install.

## Actual

Vibe has no commands directory. Its project-local surfaces are `skills/`, `tools/`, `agents/`, `prompts/`, `plugins/`, `config.toml`, and `hooks.toml`; slash commands are `user-invocable` skills, not files under `.vibe/commands/`. Everything the CommandsCapability installs is invisible to Vibe, and the rewrite/install inconsistency is moot inside a dead directory.

## Reproduction

1. Read Vibe's project-local layout reference: no `commands/` entry; skills with `user-invocable: true` are the slash commands.
2. `aidd translate --to mistral` (flat) with a plugin that has `commands/`: files land under `.vibe/commands/`, which Vibe never scans.

## Impact

AIDD commands translated for Mistral Vibe are silently dropped by the tool. The signal directory the doctor checks is likewise dead.

## Evidence

- Vibe reference skill, project-local `.vibe/` layout: `config.toml`, `hooks.toml`, `skills/`, `tools/`, `agents/`, `prompts/`, `plugins/`; no commands directory.
- `cli/src/contexts/tools/domain/profiles/mistral/profile.ts`: `signalDir: ".vibe/commands"`, CommandsCapability `buildInstallPath` flattening phase dirs, `rewriteContent` keeping them.
- Phase 5 challenge (`aidd_docs/tasks/2026_09/2026_09_29_mistral-support/challenge.md`): the review's rewrite-vs-install inconsistency is a symptom of this.

## Verification

A translated command is reachable in Vibe (as a user-invocable skill or whatever surface the design picks), or the capability is dropped and the doctor no longer points at a dead directory.

## Cancellation

—
