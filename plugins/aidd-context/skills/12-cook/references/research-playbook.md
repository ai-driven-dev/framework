<!-- Read before spawning research agents in 03-research. The scouting angles, the bar each candidate must clear, and how to verify them. Not a recipe itself. -->

# Research playbook

Guidance for `03-research`: the angles to scout, the criteria each candidate must clear, and the verification each must pass. Define the target with `assets/research-goal-checklist.md` first, and clear `assets/research-checklist.md` before drafting.

## Angles to cover

Spawn one agent per angle so coverage stays wide:

- **Alternatives** — competing tools, libraries, or methods that could replace the current approach.
- **New methods** — techniques that emerged since the recipe was written.
- **Coverage gaps** — important sub-topics the recipe omits entirely. A masterclass that forgets a core feature has a gap.
- **Counter-intuitive wins** — surprising practices that beat the obvious default, with evidence of the result.
- **Deprecations** — what the recipe still recommends that is now discouraged or dead.

## Criteria for every candidate

- **Freshness** — prefer sources from the last 12 months. Record release or publish dates. Flag anything stale.
- **Community signal** — weigh what practitioners actually say: GitHub activity, open issues, Reddit, Hacker News, discussions. Separate real adoption from hype.
- **Tips and gotchas** — capture practical advice, common pitfalls, and migration notes worth keeping.
- **Credibility** — corroborate across sources. Trust official docs over a single blog post.

## Verify each candidate

After curating, confirm every surviving candidate before presenting it. Spawn one agent per candidate to check:

- **Exists** — confirm it is real and current, not invented or abandoned.
- **Official link** — capture the canonical source: official docs, repository, or release page.
- **Latest state** — record the current version or release date.
- **Real example** — capture a usable example: copy a real output from the official docs, or run the command and capture what it prints. For an interactive command that cannot be scripted, mark the output for the human to paste. Never fabricate output.
- Drop any candidate that cannot be confirmed against an official source.

## Reporting

- Return each candidate with its angle, level, value, and a source; verified ones carry an official link.
- Push for the most insights possible, then drop anything that neither beats nor extends the recipe.
- `03-research` sorts them into three buckets: alternatives (with pros/cons), coverage gaps, and counter-intuitive wins.
