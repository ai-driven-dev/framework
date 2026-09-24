← [aidd-framework](../../README.md)

# aidd-qa

Acceptance QA concern for the AI-Driven Development framework.

> Status: new, off the curated install path until proven.

First time? Install with `/plugin install aidd-qa@aidd-framework`, then run `aidd-qa:01-acceptance-qa`.

Validates a reviewed candidate's observable behavior against its acceptance criteria and records reviewer evidence. Scenarios come only from acceptance criteria, never from the diff or the source code. Browser is the only supported interface today; a scenario without a browser-observable outcome is listed out of interface rather than tested.

## Skills

| Skill | Description |
|---|---|
| [acceptance-qa](skills/01-acceptance-qa/SKILL.md) | Validate a reviewed candidate against its acceptance criteria and record one short named video per locked scenario. |
