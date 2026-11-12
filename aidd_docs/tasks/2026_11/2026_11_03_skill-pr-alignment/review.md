# Review: skill PR alignment

- Rounds: 4
- Started: 2026-11-03

## Round 1 · r-1028

- Date: 2026-11-03
- By: Codex
- Diff: `origin/next...15c0ac079e07e02d200b710ec7ccfaeb72729260`
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 1/3 met, 2 unmet, 0 unverified at runtime, 0 out of the diff

### Criteria

- [x] Preserve observable checks after removing action test sections: `plugins/aidd-context/skills/04-skill-generate/references/skill-authoring.md:25` on #1028.
- [ ] Match #1092's router: #1028 retains `Action | Does`; #1092 uses `Action | File`.
- [ ] Match #1092's action order: #1028 puts Output before Process; #1092 puts Process before Output.

## Round 2 · r-0981

- Date: 2026-11-03
- By: Codex
- Diff: `origin/next...c067aebfa95b85dfad3df6008a0f7c300277c24c`
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 1/3 met, 2 unmet, 0 unverified at runtime, 0 out of the diff

### Criteria

- [x] Improve language choice, readability and instruction coherence: R5, R17, R18 and R20 on #981.
- [ ] Match #1092's format: #981 retains action test sections, step labels and the old router table.
- [ ] Preserve #1092's provider-discovery rule: both PRs assign different meanings to R20.

## Round 3 · r-1092

- Date: 2026-11-03
- By: Codex
- Diff: `f0df90fc...b30ea45c183fe3873ec2a6fce034cabbea5270a1` plus the merged working tree
- Axes: code, functional, relevancy
- Verdict: approve
- Score: 4/4 met, 0 unmet, 0 unverified at runtime, 0 out of the diff

### Criteria

- [x] Keep #1092's router, action order and provider isolation: R8, R11 and R20 retained.
- [x] Carry #1028's useful safeguards: observable success runs through the plan, action scaffold and process contract; write reads files back before validation.
- [x] Carry #981's compatible guidance: R5, R17, R21 and R22; no old format restored.
- [x] Put portable structured questions in the AGENTS template's Communication section, replacing its former Action rule.

The third round is static review, independently checked by a second agent. Architecture, documentation duplication, Markdown links and context-reference checks passed on the candidate. No generated skill was exercised end to end.

Tool names checked on 2026-11-03: Claude Code documents [AskUserQuestion](https://code.claude.com/docs/en/tools-reference#askuserquestion-tool-behavior); OpenCode documents [question](https://docs.opencode.ai/docs/tools/#question). This Codex session exposes `request_user_input` in Plan mode and `request_user_input_async`; OpenAI's [app-server documentation](https://learn.chatgpt.com/docs/app-server#toolrequestuserinput) documents the protocol request `tool/requestUserInput`, not a universal model-tool name. The template therefore names the capability and handles unavailable tools.

## Round 4 · r-fa98

- Date: 2026-11-03
- By: Codex
- Diff: `b30ea45c183fe3873ec2a6fce034cabbea5270a1...fa9894aa07b529f603f19d1d92b45ab7b0da28af`
- Axes: code, functional, relevancy
- Verdict: approve
- Score: 4/4 met, 0 unmet, 0 unverified at runtime, 0 out of the diff

### Criteria

- [x] Preserve the lean contract and R20: the published candidate changes neither the router nor the action section order.
- [x] Retain observable checks and file read-back: the plan, writer, action scaffold and R12 carry them.
- [x] Retain compatible writing guidance: R5, R17, R21 and R22 are present in the final diff.
- [x] Replace the old clarification rule with a portable preference in the template's Communication section.

Verification on this candidate: the commit's complete pre-commit gate passed, including 618 script tests, zero failures or skips, CLI build and three recipe validations. Commitlint passed. A separate architecture check covered 349 governed files with zero violations. The prior candidate integrated with `next` also passed 964 tests, two skipped; that is integration evidence, not the final branch's test count. No generated skill was exercised end to end. The user authorized publication into #1092, closure of #1028 and #981 as replaced, and keeping #1092 in draft.
