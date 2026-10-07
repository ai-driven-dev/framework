# Journey evidence

Nothing here evaluates the validator, and no gate reads prose, so each case is run as fresh
`claude -p` contexts given the skill text and the task, outside the repository. Criteria
fixed before running, no run repeated, every count below mechanical.

## Placement - pass

22 drafts, three requests, both text versions. Markers outside the open questions section:
**0**. Heading exact: **22/22**, though only the template names it.

## Driving to zero - not reached, and nothing now refuses a spec for it

With the text pasted into one prompt, a request answering every required field produced 0, 0,
0 entries against 3, 2, 0 before the cut. Through the installed tree it produces 3, 2, 2. The
installed figure is the one to trust: it is the route a user runs.

**No causal claim is made about either pair.** The cut changed several clauses at once, so
length is isolated in neither table, and the thin-request ranges overlap (2, 3, 2, 2, 4
against 3, 4, 3, 4, 5).

Because zero is not reached, no refusal rides on it. `open_questions_unresolved` is gone.
What invalidates a spec is a gap written outside the section, which is what #626 measured.

## The measured case - pass

Retention and the row cap left open, the two #626 measured: **2, 2, 2** entries, both versions.

## Refine - pass

| Finding | Result |
| --- | --- |
| answers one of two | the entry is gone, the other stays, 3/3 |
| answers one in part | narrowed to what remains, 3/3 |
| answers the last | `None`, 3/3 |
| spec carries no such section | the section is added, heading exact, 3/3 |

The third row failed before this round: cutting `None` from step 4 produced an empty section
3/3. The fourth is an observation, not a mechanism. Its before-and-after prompts differ by
more than the text, since the later one inlines the template, so the link `02-refine.md`
gained was never exercised as a link.

## The validator - pass

Fresh context, the yml and one spec. Stands in for the gate #625 brings.

| Spec | Verdict |
| --- | --- |
| one gap listed in its own section | valid 3/3 |
| `None`, with a gap written under `## Context` | invalid 3/3 |
| no open questions section at all | invalid 3/3 |
| `None`, every required section resolved | valid 3/3, and 3/3 again on a fuller spec |

The first row read invalid 3/3 while a hard threshold refused an open gap. It refused
complete work, so it is gone.

The fourth row failed while the yml carried no definition of a gap: an evaluator reading it
alone supplied its own, and refused a spec whose content was complete.

## The installed tree, read from disk - placement passes, zero does not

Eight sessions in eight sandboxes, each built by `aidd translate . --to claude`, each reading
`SKILL.md` and following it to the action and to whatever the action links. Real reads, real
routing, the branch's own files.

| Measure | Result |
| --- | --- |
| the section exists | 8/8 |
| markers outside it | 0/8 |
| entries, thin request | 7, 7, 5, 5, 6 |
| entries, request fully answered | 3, 2, 2 |
| `None` on a fully answered request | **0/3** |

Placement holds where it counts. Zero does not: a request answering every required field
still produces entries, and `open_questions_unresolved: invalid` then refuses the spec. Two
questions recur, the column set 3/3 and when the seven days start 3/3, and the first is
presentation detail no required section depends on.

The pasted-text runs above measured 2, 3, 2, 2, 4 entries and `None` 3/3 on the same
requests. They were optimistic. The router reads more files, and asks more.

### Why the earlier installed-skill attempt measured nothing

`aidd-pm:04-spec` resolves to the user-scope install, `~/.claude/plugins/cache/aidd-framework/aidd-pm/2.5.0`,
whatever a project declares. Those runs drafted against the published skill and reproduced
#626 exactly: no section, seven to ten markers inline. A project marketplace does not
register in a headless session either, which `Unknown skill: spec-sandbox:04-spec` says
outright. So the Skill tool's own registration is still unmeasured, and only it is.

## Not measured

The Skill tool's registration, which no sandbox can exercise while a user-scope install
shadows it. One model. And no judge classified the entries, so which gaps a draft raises
rests on reading them.
