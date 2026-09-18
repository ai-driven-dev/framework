# Architecture guard on AI-authored edits

## Target

An AI-authored edit that would break one of this repository's two named architecture rules is refused before it lands, with the offending file and line named.

## Hard constraints

- The guard decides before the edit is applied and refuses it. It is not a commit-time gate and not a continuous-integration job.
- The guard is deterministic: the same prospective file content yields the same verdict, with no dependence on model judgement and none on which AI tool made the edit.
- The guard is produced by the project's own hook-generation capability, so it exists for the AI hosts this repository configures rather than for one.
- Rule one, cross-plugin orthogonality: a plugin's dispatch surface must not name a sibling plugin by a hardcoded address.
- Rule two, router coherence: a skill's `## Actions` section must name exactly the actions that skill provides — no action file the section never names, no name the section cites without a file behind it.
- The governed surface is the dispatch surface: a skill's `SKILL.md`, its actions and its references, and an agent's definition. A plugin's `assets/` hold content shown to a reader, not dispatch, and are out of the guard's reach by this rule rather than by an unstated path filter.
- Naming that `docs/ARCHITECTURE.md` declares legitimate stays silent: an agent's permission list and an orchestration reference are responsibility maps and name their provider canonically. Flagging either is a defect of the guard, not of the tree.
- Every refusal names the file, the line, and the plugin that owns the addressed capability, in terms a reader can act on without opening the rule document.
- The guard is silent on the repository as it stands. A rule that reports a violation in the current tree is miscalibrated, not vindicated.
- The rules are exercised by purpose-built fixtures. No historical code from #406 is used as a fixture.
- Each rule is proved by a fixture that breaks it and turns exactly the test named for that rule red, and by a fixture of legitimate naming that stays green.

## Non-goals

- A `lefthook` pre-commit gate for these rules. The decider ruled it out on 2026-09-14.
- A CI job enforcing these rules.
- Judging whether a skill's prose `description` has gone stale. Nothing mechanically separates stale prose from current prose, so the issue's "router/description mismatch" is served by the router half alone.
- Reaching into a plugin's `assets/`. A recipe sheet names the commands a reader types; that is its subject, not a dispatch this rule governs.
- Repairing violations that exist in the tree today. That was #406, now closed.
- Enforcing any architecture rule beyond the two named above.
- Catching a violation introduced outside an AI tool, by a human editing by hand.
- Catching a write performed through a shell command rather than a write tool. Deciding whether a shell line writes a plugin source means parsing arbitrary shell, which is not the deterministic verdict rule one requires. An agent told to edit through `sed` or a heredoc is therefore ungoverned, and that is stated here rather than left to be discovered.
- Making `aidd-context:00-onboard` resolve its providers at runtime. Its reference menus name addresses because those addresses are what it hands a person to type, so it is exempt by a named rule with a follow-up issue behind it, not by silence.
- Shipping the guard into projects that install this marketplace. The rules govern this repository's own plugin sources.

## Done-when

- An edit that would leave a skill's dispatch surface holding a sibling plugin's hardcoded address is refused, and the refusal names that file, its line, and the plugin that owns the address.
- An edit that would leave a skill's `## Actions` section naming an action the skill does not provide, or omitting one it does, is refused, and the refusal names the file and the line.
- An edit that writes an agent permission list, or an orchestration reference, naming its provider canonically is applied with no complaint.
- Breaking each rule in its fixture turns red exactly the test named for that rule, and no other test.
- The refusal reaches the author in the same turn as the edit that caused it, before any commit, push, or CI run.
- Every plugin source in the repository as it stands passes both rules.
- A contributor who has never read `docs/ARCHITECTURE.md` can correct a refused edit from the refusal text alone.

## Stakeholders

- Decider: the repository owner, who ruled out the commit-time and CI mechanisms on 2026-09-14.
- Owner: the framework maintainers.
- Consumer: every contributor and every agent that edits a plugin source in this repository.

## Context

- Backlog item: [ai-driven-dev/framework#250](https://github.com/ai-driven-dev/framework/issues/250).
- The `00-onboard` exemption has an expiry, not a pass: [ai-driven-dev/framework#883](https://github.com/ai-driven-dev/framework/issues/883) makes that skill resolve its providers at runtime, and closing it closes the exemption.
- The issue body's "Guardrail local et CI" section predates the 2026-09-14 comment on the same issue and is superseded by it. The comment is the governing statement: no Git hook, no CI gate, synthetic fixtures, #406 neither blocker nor fixture.
- The orthogonality rule and its legitimate exceptions are stated in `docs/ARCHITECTURE.md`, under capability addressing: a capability is addressed only where the dispatch is declared, and elsewhere the concept is named instead of the skill that owns it.
