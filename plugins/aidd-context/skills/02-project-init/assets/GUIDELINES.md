# Developer Guidelines (AI Pilot)

How a developer should operate AI coding assistants to maximize quality, speed, and reliability.

---

- [1) Operating mindset](#1-operating-mindset)
- [2) Start of task checklist](#2-start-of-task-checklist)
- [3) Planning before coding](#3-planning-before-coding)
- [5) Implementation loop](#5-implementation-loop)
- [6) Review loop](#6-review-loop)
- [7) Prompting hygiene](#7-prompting-hygiene)
- [8) Context hygiene](#8-context-hygiene)
- [9) Quality discipline](#9-quality-discipline)
- [10) Delegation strategy](#10-delegation-strategy)
- [11) Failure and recovery strategy](#11-failure-and-recovery-strategy)
- [12) Team-level practices](#12-team-level-practices)
- [13) Anti-patterns to avoid](#13-anti-patterns-to-avoid)
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
- Validate 100% of plan before execution.
- Split large tasks into small increments.
- Keep one behavior per increment.
- Refuse execution if plan has ambiguity.

## 5) Implementation loop

For each increment:

1. Ask for minimal change set.
2. Read generated diff.
3. Stage intentionally (file by file or hunk by hunk).
4. Run assertions and tests.
5. Ask AI to fix only failing points.
6. Re-run checks until green.

## 6) Review loop

- Run technical review (`rules`, defects, regressions).
- Run functional review (expected behavior vs implementation).
- Manually read staged diff before commit.
- Require evidence for claims ("works", "tested", "fixed").

## 7) Prompting hygiene

- Give context, constraints, and expected output format.
- Request concrete file paths and commands.
- Ask for assumptions explicitly.
- Ask for tradeoffs when options exist.
- Keep prompts scoped; avoid multi-objective prompts.
- If output quality drops, reset with a fresh focused prompt.

## 8) Context hygiene

- Keep rules concise and non-conflicting.
- Avoid duplicate sources of truth.
- Keep project memory updated (`architecture`, `testing`, `vcs`, `decisions`).
- Prefer canonical docs referenced by path.
- Remove stale instructions quickly.

## 9) Quality discipline

- For bug fixes: failing test first, then fix.
- Keep structural and behavioral changes separated.
- Keep commits atomic and intention-revealing.
- Never skip validation to "save time".
- Never merge code you do not understand.

## 10) Delegation strategy

- Low risk: semi-autonomous execution with checkpoints.
- Medium risk: tighter loop, smaller increments, frequent review.
- High risk: manual supervision, explicit approvals at every gate.
- Critical systems: mandatory peer review before merge.

## 11) Failure and recovery strategy

- Stop if AI drifts from objective.
- If same failure repeats, change approach (not just prompt wording).
- If context is polluted, restart session with minimal clean context.
- Keep checkpoint commits before long autonomous runs.
- Escalate early when uncertainty remains high.

## 12) Team-level practices

- Standardize shared prompts/commands/rules in repo.
- Use common commit and PR templates.
- Track recurring failures and add guardrails.
- Review and improve guidelines monthly.
- Keep onboarding docs short and actionable.

## 13) Anti-patterns to avoid

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
- OpenAI Cookbook, "Eval-driven development": <https://cookbook.openai.com/examples/evaluation/use-cases/evalsapi_tools_evaluation>
- GitHub Docs, "Repository custom instructions for Copilot": <https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/adding-repository-custom-instructions-for-github-copilot>
