← [aidd-framework](../../README.md)

# aidd-qa

Acceptance QA concern for the AI-Driven Development framework.

> Status: new, off the curated install path until proven.

First time? Install with `/plugin install aidd-qa@aidd-framework`, then run `aidd-qa:01-acceptance-qa`.

Verifies a reviewed candidate's observable behavior against its acceptance criteria into a verdict report, and shows a journey as a short video. Scenarios come only from acceptance criteria, never from the diff or the source code. Browser is the only supported interface today; a scenario without a browser-observable outcome is listed out of interface rather than tested.

## Skills

| Skill | Description |
|---|---|
| [acceptance-qa](skills/01-acceptance-qa/SKILL.md) | Validate a reviewed candidate against its acceptance criteria into a verdict report. |
| [demo](skills/02-demo/SKILL.md) | Show a journey as one short video labelled with the observed outcome. |
