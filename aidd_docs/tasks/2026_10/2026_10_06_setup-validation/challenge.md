My confidence level of correctness now: 95%

# Correctness (100%)
- The delivered change matches the agreed issue #891 contract: unsupported user-scope plugin selections retain the existing cause/remedies and exit 1 through the presentation error handler. `setup.ts:156-195` guards constructor validation without moving policy out of `SetupFlow`.
- Independent focused verification against commit `65d1917a`: 62 tests passed, including seven hermetic built-binary tests. Exact stderr assertions exclude stack traces and bundle dumps; supported user setup still leaves the project unchanged. Full suite and required repository gates are evidenced in the review report.
- The README distinguishes user registration, native activation, plugin file installation and project hooks. Support derives from present profiles; no global installer or configuration rewriting was introduced. Help enumerates supported tools from the existing predicate rather than duplicating policy.
- Edge cases considered: all/recommended/named plugin modes; empty or omitted AI selection; IDE selection; unsupported AI tools; project-scope behavior; supported user setup; missing native binaries. Broader setup construction errors also reach the same handler. Invalid parser inputs keep their existing handling.
- Trust answers are all yes: the implementation is appropriately small, consequential choices preserve existing policy, and the user's end-to-end refusal and discoverability needs are met. No issue-contract gap or delivery blocker found.

# Deal breakers
- None.

# Suggestions (enhancements only)
- Clarify the plan's “dependencies are not created” wording to identify the setup action. Existing `cli.ts:55-61` can construct dependencies in the unchanged startup update-check hook; command tests and hermetic e2e prove the intended command-local boundary. The caller has confirmed this scope and owns the wording correction. No code expansion is warranted for issue #891.
