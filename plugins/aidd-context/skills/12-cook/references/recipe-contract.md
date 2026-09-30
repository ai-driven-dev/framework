<!-- Cited by upsert and validate. The rules every recipe file follows. -->

# Recipe contract

Rules for every recipe file the skill writes.

## File

- Project path: `aidd_docs/recipes/<kebab-slug>.md`.
- Follow the layout and heading format in `assets/recipe-template.md`.
- The description has no "Goal:" label, blockquote, or metadata table.
- End with at most one short conclusion. Never add a `## Related` section: links live inline where they are used.
- Never add `## Why`: the description states the outcome and each technique states its own benefit or risk.
- Every table-of-contents anchor must resolve.

## Writing

- Write for execution: preserve commands, configurations, examples, screenshots, limits, evidence, and verification; remove narrative, repetition, transitions, and theory that do not change an action.
- One idea per sentence. Prefer removing over adding.
- No filler line under a heading (no "Ranked by impact", "Start at the top", and the like).
- Distinguish primary and secondary benefits. State conditional, neutral, and net-negative cases instead of implying a universal win.

## Steps

- Heading levels express nesting. Never skip a level: a heading may be at most one level deeper than the heading before it.
- One step = one technique named for its action. Split distinct responsibilities, inputs and outputs, alternatives, or tools unless comparing them is the technique.
- Add prose only when it is required to operate, verify, or bound the technique.
- A single command, configuration, or example may stand alone. Write descriptions as prose, never as a bullet.
- State applicability and location for every technique. For an installed tool or persistent configuration, also give the official installation, real invocation, and stop, disable, or rollback path when available; state explicitly when the official source documents no reversal.
- Reuse the tool's canonical example captured verbatim from its site or README — never a paraphrase, and never on the strength of a summary that says one exists.
- Every step carries a copyable, syntactically valid example. Prefer an image — a screenshot or short video/GIF that matches the action — when it adds operational information; for a tool, use its official screenshot when available. Otherwise use a command with real output, a config in the file's real syntax, or a snippet.
- Compare alternatives in a table, not prose. Test each mechanism alone before recommending a combination; state conflicts and ordering.
- For a structural or flow concept (a proxy, a pipeline, an architecture), add a small Mermaid diagram with concrete example values.
- Group steps by difficulty only when the recipe spans levels and grouping helps the reader. Include only levels that have a step.
- Link to a reference when applicable.

## Evidence

- Verify commands, configuration keys, compatibility, and behavior against current official documentation. Record a version or publication date when the source can drift; prefer immutable or pinned references for reproducible assets.
- Make the evidence class clear from the sentence or source framing: **independent measurement**, **maintainer claim**, or **inference**. A linked first-party behavior claim is a maintainer claim without needing a repeated label; qualify anything whose strength is not obvious. Never turn an inference or unverified summary into a fact.
- Do not promise token, time, cost, or quality savings without a published measurement. State the workload and caveat when a result may not transfer.
- Compare benchmarks with the same model, effort, task, and quality gate. Count input, output, reasoning, tool output, and subagent overhead; a smaller main context is not automatically lower total usage.
