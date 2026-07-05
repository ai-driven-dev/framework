# Developer Guidelines (AI Pilot)

How a developer should operate AI coding assistants to maximize quality, speed, and reliability.

---

- [1) Operating mindset](#1-operating-mindset)
- [2) Start of task checklist](#2-start-of-task-checklist)
- [3) Planning before coding](#3-planning-before-coding)
- [4) Implementation loop](#4-implementation-loop)
- [5) Review loop](#5-review-loop)
- [6) Prompting hygiene](#6-prompting-hygiene)
- [7) Context hygiene](#7-context-hygiene)
- [8) Quality discipline](#8-quality-discipline)
- [9) Delegation strategy](#9-delegation-strategy)
- [10) Failure and recovery strategy](#10-failure-and-recovery-strategy)
- [11) Team-level practices](#11-team-level-practices)
- [12) Anti-patterns to avoid](#12-anti-patterns-to-avoid)
- [References (official)](#references-official)

---

## 1) Operating mindset

- Treat AI as a powerful pair, not as an authority.
- Keep human accountability for architecture, product impact, and merge decisions.
- Prefer explicit instructions over implied expectations.
- Optimize for correct outcomes first, speed second.

## 2) Start of task checklist

- [ ] Clarify objective in one sentence.
- [ ] Define explicit done criteria.
- [ ] Define non-goals (what must not be changed).
- [ ] Identify impacted files/modules.
- [ ] Decide risk level (low, medium, high).
- [ ] Decide required validation depth (`minimal`, `standard`, `full`).

## 3) Planning before coding

- Ask AI for a short implementation plan first.
- Review and approve the full plan before execution starts.
- Split large tasks into small increments, one behavior per increment.
- Reject the plan if anything in it is ambiguous.

## 4) Implementation loop

For each increment:

1. Ask for minimal change set.
2. Read generated diff.
3. Stage intentionally (file by file or hunk by hunk).
4. Run assertions and tests.
5. Ask AI to fix only failing points.
6. Re-run checks until green.

## 5) Review loop

- Run technical review (`rules`, defects, regressions).
- Run functional review (expected behavior vs implementation).
- Manually read staged diff before commit.
- Require evidence for claims ("works", "tested", "fixed").

## 6) Prompting hygiene

- Give context, constraints, and the expected output format.
- Request concrete file paths and commands.
- Ask the AI to state its assumptions and tradeoffs.
- Keep each prompt scoped to one objective.
- If output quality drops, reset with a fresh, focused prompt.

## 7) Context hygiene

- Keep rules concise and non-conflicting.
- Avoid duplicate sources of truth: reference canonical docs by path instead of repeating them.
- Keep project memory updated (`architecture`, `testing`, `vcs`, `decisions`).
- Remove stale instructions quickly.

## 8) Quality discipline

- For bug fixes: failing test first, then fix.
- Keep structural and behavioral changes separated.
- Keep commits atomic and intention-revealing.
- Never skip validation to "save time".
- Never merge code you do not understand.

## 9) Delegation strategy

- Low risk: semi-autonomous execution with checkpoints.
- Medium risk: tighter loop, smaller increments, frequent review.
- High risk: manual supervision, explicit approvals at every gate.
- Critical systems: mandatory peer review before merge.

## 10) Failure and recovery strategy

- Stop if AI drifts from objective.
- If same failure repeats, change approach (not just prompt wording).
- If context is polluted, restart session with minimal clean context.
- Keep checkpoint commits before long autonomous runs.
- Escalate early when uncertainty remains high.

## 11) Team-level practices

- Standardize shared prompts/commands/rules in repo.
- Use common commit and PR templates.
- Track recurring failures and add guardrails.
- Review and improve guidelines monthly.
- Keep onboarding docs short and actionable.

## 12) Anti-patterns to avoid

- Asking for implementation before validation of plan.
- Approving giant diffs without incremental checkpoints.
- Combining unrelated changes in one PR.
- Trusting green tests when scope of tests is unclear.
- Letting AI decide merge/deploy without explicit approval.
- Keeping endless chat sessions after coherence loss.

## References (official)

- Anthropic, "Prompt engineering overview": <https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview>
- Anthropic, "Claude Code memory": <https://docs.claude.com/en/docs/claude-code/memory>
- OpenAI, "Prompt engineering best practices": <https://help.openai.com/en/articles/6654000-best-practices-for-prompting>
- GitHub Docs, "Repository custom instructions for Copilot": <https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/adding-repository-custom-instructions-for-github-copilot>
