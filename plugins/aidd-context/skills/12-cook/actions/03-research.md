# 03 - Research alternatives

Research verified improvements to one recipe or topic.

## Input

The recipe or topic to modernize, named by number from the latest list, slug, title, or topic.

## Output

Verified alternatives, coverage gaps, and counter-intuitive wins sorted by value, with a recommendation.

## Process

1. **Refine.** Fill [research-goal-checklist.md](../assets/research-goal-checklist.md) with the user until the outcome, level, scope, and grouping are precise.
   - Resolve and read an existing recipe with [recipe-locations.md](../references/recipe-locations.md).
2. **Scout.** Cover every angle in [research-playbook.md](../references/research-playbook.md), returning candidates with sources.
   - The caller may isolate or parallelize independent angles; no particular delegation mechanism is required.
3. **Curate.** Dedupe the candidates and sort each bucket by value.
   - Drop anything that neither beats nor extends the recipe.
   - Clear [research-checklist.md](../assets/research-checklist.md): gaps filled, unknowns surfaced, claims corroborated.
4. **Verify.** Apply the playbook's candidate checks to confirm each surviving item's existence, latest state, and official link.
   - Drop anything that cannot be confirmed against an official source.
5. **Present.** Render the three parts below, each sorted by value with official links, then state a recommendation and why.
   - Alternatives table: `| Alternative | What it is | Pros | Cons | Official link |`.
   - Coverage-gaps list: omitted sub-topics and why each matters.
   - Counter-intuitive wins list: surprising tips and the result each produces.
   - Keep research ephemeral; do not write files.

## Test

| Case | Pass |
| --- | --- |
| Completed research | Alternatives with pros and cons, coverage gaps, counter-intuitive wins, and a recommendation are presented without writing files |
| Presented items | Each exists in its latest verified state and carries an official link; unverifiable candidates are dropped |
| Candidate evidence | Every candidate clears the playbook's evidence and transferability criteria |
| Research completion | The checklist clears with gaps filled, unknowns surfaced, and claims confirmed before any write hand-off |
