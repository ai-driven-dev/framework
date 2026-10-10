# Revised candidate verification

This report records the earlier writer candidate `9fa10479…`. The current presentation correction and its fresh deterministic/runtime-input checks are recorded in [Readable shared rule verification](rule-presentation/verification.md). Historical subscription-model receipts retain their original writer hash.

## Candidate
The autonomous script is 14,069 bytes, SHA-256 `9fa10479a267d899a6a024f68e75573f1d009080cd60851f23f06c8f2d190591`. The installed copy used in final runtime probes has exactly the same hash. CLI source/config/tests/docs match pinned base 12777d03: `git diff --exit-code 12777d03 -- cli/` exits 0. Personal .gitignore and .hermes.md remain outside this candidate.

## Automated checks
- `node --test scripts/__tests__/rule-generation.test.js`: 41 passed, zero failures/skips. Actual Node child processes execute from copied skills with empty PATH in ESM projects. Covers five adapters, exact content, shared deduplication, create/update/delete/publish, user/memory/CRLF bytes, unsafe paths and contributions, and ownership tied to target path.
- Meaningful red-to-green witnesses: missing script, first-write YAML/fence input, invalid UTF-8, and a signed native file copied from another rule. These are revised script regressions; the old CLI reports do not validate this implementation.
- `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'`: 595 passed, zero failures/skips. Final run includes staged added/deleted paths. An earlier run failed two file-enumeration guards because deleted CLI files remained in the Git index; staging the authorized removals resolved those ENOENT failures without guard changes.
- `pnpm --dir cli test`: 6,836 passed, one existing opt-in Kilo test skipped. `pnpm --dir cli test:arch`: 142 passed. CLI lint, typecheck, knip and `node scripts/check-cli-type-honesty.mjs`: exit 0.
- `pnpm --dir cli build`: 733.98 KB, original 734 KB budget, no new dependencies or budget increase.
- Architecture, context-import, reference-form, referenced-path, document-duplication, Markdown-link and skill-argument-hint guards: exit 0. Whitespace check: exit 0.

## Delivered skill assets
Real `node cli/dist/cli.js translate <repo> --to <tool> --as <layout> --out <temp>` builds verified Claude/Cursor/Copilot/Codex in both marketplace and flat layouts, plus OpenCode flat. Every delivered script is byte-identical and successfully executes without AIDD in an ESM host. OpenCode marketplace remains unsupported by the existing capability contract. Evidence: `/private/var/folders/xr/1vw6jx411dxf789cdlv_jg4c0000gn/T/aidd-rule-repair-delivery-wrAYM5/summary.json`.

## Independent review repairs
The first review found two defects: unsigned separator metadata could remove a user newline, and invalid request bytes or escaped lone surrogates could be silently replaced. The repaired contribution digest binds separator and payload; strict UTF-8 decoding also applies to external JSON input, and parsed text must round-trip through UTF-8. Thirteen refusal cases were red before repair and green afterwards, with exact Buffer snapshots of every project file. A positive Unicode case preserves valid pairs, literal U+FFFD and CRLF. The 41 focused tests include six separator edits (both directions across update/publish/delete), raw byte 0xff, and high/low lone surrogates in body/description/paths. Repository tests, all nine delivered copies and all six model-input captures were rerun on the repaired hash above. No compatibility fallback trusts the previous unsigned boundary.

## Real model-input captures
On macOS arm64, isolated OpenCode 2.0.22 and Codex 0.160.1 used local mock providers with fixed responses, no tools and no paid inference. Each host was exercised after the other automated gates, against the final installed script's five-target output, for creation, update and last-rule deletion. Full bodies were found in actual HTTP model requests, not inferred from assistant self-reports. Updated requests omit the initial marker; deleted requests omit both generated markers while preserving user guidance. A repeat update is byte-identical; deletion restores the exact original AGENTS.md bytes and removes all native outputs. OpenCode also ignores the inert config.instructions-only source.

[Runtime results](runtime-results.json) record captures, hashes, version, platform and per-journey checks. OpenCode makes two requests per journey; Codex makes one POST /v1/responses. Harnesses: `/tmp/aidd-913-runtime-NAuUNo/runtime_probe.py <project> <case> --present <marker> --absent <marker>` and `/tmp/aidd-913-codex-probe-sEcW3B/probe.py --project <project> --expect <marker> --absent <marker>`. Final test project: `/private/tmp/aidd-rule-revision-runtime-lucrc3s6/project`.

An independent discovery probe also verifies Codex root guidance, root override replacing AGENTS.md, and root-to-nested ordering. Its three actual request captures are in `/tmp/aidd-913-codex-probe-sEcW3B/results/`, separate from the final generated-project captures.

## Bounds
Claude/Cursor/Copilot have native-format and delivered-execution coverage, not real model-input captures. No Linux/Windows runtime claim. In-file scopes are model guidance for Codex/OpenCode. Local AGENTS size checks cannot guarantee Codex's combined global/project budget. Other hosts may discover both shared and native guidance. Legacy rules are not migrated; validation preflight and per-file atomic replacement do not promise multi-file I/O rollback or concurrent-writer safety.

Independent [review](review.md) and [challenge](challenge.md) accepted the repaired candidate: seven of seven criteria fulfilled, no open finding, with the bounds above preserved.

## Realistic sandbox supplement

Subsequent subscription-model testing and local skill-instruction corrections are recorded in the [realistic sandbox report](realistic-sandbox/REPORT.md), with [machine-readable results](realistic-sandbox/native-results.json) and a [portable deterministic reproduction](realistic-sandbox/reproduction/README.md). This supplement retains failed native attempts, distinguishes instruction revisions and harness corrections, and explicitly records Cursor’s quota-limited final session and incomplete native exact-update control. The earlier bounds above describe the previously committed candidate, not this later native evidence. No additional commit or push was made for the supplement.
