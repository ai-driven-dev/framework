# Autonomous rule generation

## Target
Generate project guidance for the five confirmed hosts (Claude Code, Cursor, GitHub Copilot, Codex and OpenCode V2) through an installed rule-generation skill, without an installed AIDD CLI or framework checkout.

## Hard constraints
- Use the verified native instruction surface and scope syntax of each host. Codex and OpenCode share one project instruction contribution, with each rule appearing once in that file.
- Preserve complete rule content, user-authored guidance and unrelated project memory. Do not silently summarize content, alter host configuration, or migrate existing rules.
- Validate all prospective targets before changing any requested file. Invalid metadata, unsafe paths, ambiguous contributions or edited generated content must fail without a partial validation write.
- Repeated generation is byte-idempotent. Updating or deleting a rule updates or removes the corresponding contribution without retaining stale guidance.
- Describe file discovery separately from model consumption. Scopes expressed in a project instruction document are model guidance, not native glob filters.
- Preserve existing CLI behavior from the pinned PR base. Rule production belongs to aidd-context; remove the initial candidate's CLI publication mechanism.
- Require explicit confirmed target hosts. A shared instruction document alone does not identify which hosts are installed.

## Non-goals
- OpenCode V1, installation lifecycle synchronization, automatic migration of prior rule sources, flat archive distribution of standalone rules (#789), or Kilo (#914).
- Changing model instruction discovery, execution policies, trust, configuration limits, or global user guidance.
- Runtime guarantees for unexercised host versions and platforms.

## Done-when
- A copied installed skill can create, update and delete rules in an unrelated project, including an ES module project, using Node and no AIDD CLI.
- Claude, Cursor and Copilot receive their native file extensions and metadata. Codex receives AGENTS.md guidance rather than Markdown files presented as execution policies.
- Codex and OpenCode selected together receive one shared contribution. Existing guidance survives creation, updates and removal of the last generated rule.
- Tests cover prospective validation, edited/duplicate/incomplete contributions, symlink and traversal rejection, scope serialization, exact body preservation and idempotence.
- Repository guards and applicable delivery checks pass. Fresh OpenCode V2 model-input evidence proves the revised script's publication reaches the model.
- Independent review and challenge judge the revised contract and final candidate. The existing draft PR describes this revision and the limits of its evidence.

## Context
The user explicitly accepted all five hosts in PR #979 after rejecting mandatory CLI coupling. This contract supersedes the initial candidate at 4ca83525; the previous immutable spec and reports remain historical evidence only. Source issue: [#913](https://github.com/ai-driven-dev/framework/issues/913).
