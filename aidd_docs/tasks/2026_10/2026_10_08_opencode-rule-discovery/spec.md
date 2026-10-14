# OpenCode rule discovery

## Target
Make directly generated and CLI-installed project rules available in OpenCode V2's active project instruction context.

## Hard constraints
- Preserve user-authored instructions, their duplicates and order, and unrelated configuration comments and formatting.
- Repeated generation, installation and synchronization must preserve the same effective instructions without creating duplicate AIDD contributions.
- Invalid, ambiguous or unsafe configuration must produce an actionable error without a partial write.
- Describe support according to the verified host version; a file or accepted configuration field alone does not prove that its content reaches the model.
- Target OpenCode V2 only. Its documented active project instruction surface is AGENTS.md; configuration.instructions does not activate rule files.
- Preserve user-authored AGENTS.md content and the existing AIDD project-memory block. Refuse to overwrite an AIDD rule contribution that the user has edited.
- Never claim native glob-based rule scoping from OpenCode V2. Any rule scope retained in the instruction text must be described as an instruction to the model.

## Non-goals
- Flat archive rule and command distribution, owned by #789.
- Kilo generation and distribution, owned by #914 and #868.
- Changing OpenCode's own instruction discovery or implementing unrelated hooks or commands.
- OpenCode V1 compatibility guarantees or runtime coverage.
- Project-memory generation; this delivery publishes existing rule content only.

## Done-when
- A project detected from its OpenCode directory or JSON/JSONC configuration can generate a rule that OpenCode V2 actually includes in its instruction context.
- The CLI installation and synchronization paths provide the same observable rule discovery guarantee.
- Existing user content remains intact, a second run adds no duplicate contribution, and refused updates leave project files unchanged.
- Documentation distinguishes the supported version contracts and identifies any unsupported version explicitly.
- Runtime evidence identifies the exercised OpenCode versions and platforms and demonstrates instruction content reaching the model.
- Changing or deleting a source rule updates or removes its active contribution. Removing the last AIDD contribution or uninstalling its source preserves all user-authored project guidance.

## Context
- Source: [framework issue #913](https://github.com/ai-driven-dev/framework/issues/913).
- [Official contract verification](./official-verification.md), checked 2026-10-08.
- Scope decision: the user's request on 2026-10-08 targets V2 only, superseding the original issue's V1 configuration-backed design for this delivery.
