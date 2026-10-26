# The startup greeting reads the installed framework version at session start

- Date: 2026-10-26
- Status: Accepted, implements #980
- Decided by: proposed here, for @alexsoyes to confirm or overturn

## Context

#980 wants the greeting to name the framework release a person runs, and to say when a newer one exists. A version stamped into the `AGENTS.md` template is copied once into a project, so it goes stale at the first upgrade and is shared by every teammate whatever each one installed. Asking the model to find the version is non-deterministic, and an installed project holds no marketplace manifest to read.

## Decision

`aidd-context` owns one `SessionStart` script, `hooks/framework-version.cjs`, dependency-free:

- It reads the marketplace version locally, from the installation's own provenance: Claude Code's plugin cache and `known_marketplaces.json`, the `aidd` CLI's `.aidd/manifest.json` and `marketplaces.json`, or a marketplace directory holding the script. Anything else is reported as unknown, never replaced by a plugin or CLI version.
- It hands the version to the conversation as `additionalContext`. The greeting line in the agent files names that context, so the model repeats a value it was given, it does not look one up.
- A newer release is looked up only on the same source and branch: the raw `marketplace.json` of the GitHub repository and ref the installation came from. Local checkouts, pinned tags or commits and other hosts are never compared. The answer is cached for 24 hours in the CLI's own cache directory and refreshed by a detached child, so a session start never waits on the network and a failed fetch never reads as "up to date".
- A known newer release adds a `systemMessage`, shown by Claude Code and Codex without the model, with the update command for that installation mode. Nothing is installed.
- OpenCode runs `SessionStart` at plugin initialization and used to discard its output. The generated bridge now captures it and adds it to every model call: V1 through `experimental.chat.system.transform`, V2 through `session.hook("context")`.

## Consequences

- After an upgrade, the next session names the new version, without regenerating `AGENTS.md`.
- The first session after the cache expires learns nothing new; the one after that does.
- On OpenCode, the version is resolved when the server starts, not per conversation in a long-running server.
- Codex's output contract is the same as Claude Code's, but no Codex session was run to prove it.
