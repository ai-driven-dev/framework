My confidence level of correctness now: 68%

# Correctness (100%)

- The A/B ownership and foreign-state behavior is backed by 6,464 passing tests, byte-for-byte collision smoke, and an independent checker with no remaining confirmed security blocker.
- The core #829 behavior is supported, but the strict delivery claim is not correct yet: `framework` mutation scored 86.7% against its declared 93% floor, while 13 final-tree scopes remain unchecked. The user authorized a partial draft, not a green gate or merge.
- Copilot 1.0.83 fails closed on native source proof. That preserves existing state but does not deliver fresh native activation on that installed version.

# Deal breakers

- Do not mark the issue closed or the draft PR merge-ready under strict SDLC. At least 515 additional framework mutants must be detected to meet the existing floor; targeted witnesses or a simpler proof flow need a new validated candidate.
- Partial Copilot 1.0.83 functionality must remain explicit in the draft. Native fresh activation is not verified, so end-to-end satisfaction remains uncertain.

# Suggestions (enhancements only)

- Inventory changed-line mutants before the expensive whole-scope campaign, then test each negative and positive ownership branch; retain the whole-scope gate for the final tree.
- Keep a single source/test SHA and Node/HOME fixture contract through full gates and mutation. Reuse a green report only when those inputs are identical.
