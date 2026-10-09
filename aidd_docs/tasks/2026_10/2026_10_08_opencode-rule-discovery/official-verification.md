# OpenCode instruction contract verification

Checked on 2026-10-08 before planning or implementation. These are documentation findings, not runtime verification.

## V1
- [Rules](https://opencode.ai/docs/rules/#custom-instructions): project guidance is loaded from AGENTS.md; additional paths and globs in configuration.instructions contribute instruction content alongside it. CLAUDE.md is a compatibility fallback.
- [Configuration format](https://opencode.ai/docs/config/#format): JSON and JSONC are supported, including comments and trailing commas.
- The rules guide documents no automatic scan of .opencode/rules/. A modular file placed there needs explicit configuration wiring under the V1 contract.

## V2
- [Configuration](https://opencode.ai/v2/docs/config#instructions): instructions is accepted but its entries are not loaded; use AGENTS.md for active instructions.
- [Instruction configuration](https://opencode.ai/v2/docs/instructions#configuration): files, glob patterns and URLs in instructions are not resolved.
- [Instruction scope](https://opencode.ai/v2/docs/instructions#scope): V2 recognizes AGENTS.md only and has no CLAUDE.md fallback. Ambient and nested instruction discovery have their own documented scope and ordering.
- The [migration guide](https://opencode.ai/v2/docs/migrate-v1/) still lists instructions among fields requiring no migration. This conflicts with the explicit limitation in both dedicated guides. Do not infer active instruction loading from schema acceptance or that migration summary; require a runtime witness for any shipped claim.

## Impact on #913
The issue's September 24 contract assumes that configuration-backed modular rules reach OpenCode's instructions. Current official documentation supports that design for V1, but explicitly rejects its effectiveness in V2.

Choose one contract before implementation:
1. Retain the V1 design and explicitly disclose the V2 limitation.
2. Extend the outcome to V1 and V2, revisiting the issue's decision that AGENTS.md is not the destination for modular rules. Agree preservation and ownership before projecting a V2 adaptation.

Decision recorded after verification: target V2 only. Publish active rule text through its documented AGENTS.md surface, preserving user content. The original config-backed design is superseded for this delivery; do not extend V1 claims.

The local opencode binary reported 1.14.20. This establishes only the installed version; it does not validate either instruction contract.
