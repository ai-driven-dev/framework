# Run: aidd-ui 4c, inherited background and C3 noise

Evidence for [the plan](4c-heritage/plan.md): one pilot pass, the checks on its output, the suites, and the mutation of each guard.

## Suites

- Wrapped scripts suite: 1754 pass, 0 fail, 0 skipped.
- `pnpm exec lefthook run pre-commit`: green on both commits.

## Pilot

Blank once, Gouvernail once, in parallel. Gouvernail is a `git archive` copy of a clean worktree; the checkout was only read.

```txt
blank errors none warnings V6 wireframes all screens all code untouched steps ok
gouvernail errors none warnings C3,C4,V6 wireframes all screens all code untouched steps ok
```

## Text colours V11 reads

Rules counted by a throwaway copy of the new engine with the threshold set to 22. A pair sets colour and background; an inherited rule sets colour alone.

| Output | Pairs | Inherited | Colour-only rules |
| --- | --- | --- | --- |
| Gouvernail, this run | 26 | 30 | 30 |
| Blank, this run | 21 | 5 | 5 |
| Gouvernail, previous run | 32 | 64 | 66 |
| Kairos, previous run | 45 | 52 | 59 |

Before this slice, the inherited column was zero everywhere.

## Findings on real output

With the real engine, no screen of this run fails V11.

On the previous Kairos output, the first engine named three rules:

- `.friend-banner span` read on `.friend-banner .avatar`, 1.06:1. False: the avatar's own pair sets its colour and wins the cascade.
- `.result-summary span` read on `.result-summary .mark`, 3.80:1. False, for the same reason.
- `.winner-banner span`, secondary text on a translucent green over the body, 3.80:1 in both themes. Kept: the text sits on that banner.

The two false ones led to one fix, test first: an element a base pair targets is read by that pair alone. The third remains.

The review then removed four untested guards, with no change on real output.

The state fix surfaced a false error on blank: `[data-zone="hero"]` matched every descendant, so each `.button` took the hero's colour. Reading attribute names fixed it. Rerun on the blank, Gouvernail and Kairos outputs, only the two `.winner-banner span` lines remain.

## C3 and the code roots

| | Code roots | C3 | C4 |
| --- | --- | --- | --- |
| Previous run | `[src]` | 3297 | 11 |
| This run | `[src/components/ui, src/features, src/modules, src/routes, src/styles]` | 1694 | 4 |

The server and generated folders are out. Two remain, as a finding, with no rerun:

- `src/modules/common`: 363 C3. Domain and persistence code, not UI.
- `src/routes/api`: 41 C3. Server routes under a UI folder.

Server files also remain beside UI files: 162 `*.server.ts` under `src/features` and `src/routes`, plus schema and model files. `ignore` matches a folder prefix, so it cannot leave them out. The done-when "no server C3" is not met.

## Mutations

Each guard broken once, its own test red, then restored. The `FIXES` ledger test also went red each time.

| Guard | Mutation | Red test |
| --- | --- | --- |
| Ancestor's background | only pairs read | is read on the opaque background of an ancestor |
| Own background, another rule | walk starts at the parent | is read on a background another rule sets on the element itself |
| Nearest wins | farthest taken | is read on the nearest background, not a farther one |
| Whole chain | last compound only | follows the whole descendant chain, not its last compound |
| `::` not a background | filter removed | takes a pseudo-element's background for none behind the text |
| Void tags | list emptied | does not open an element for a void tag |
| Translucent ancestor | not composed | composes a translucent ancestor over the body's |
| Nothing up to body | default white | leaves a text unchecked when no background lies behind it up to the body |
| Two backgrounds | last kept only | reads each of two backgrounds on one element |
| Dedupe by background rule | keyed by position | names a rule once for a background it reaches in two containers |
| State then base | walk stops at the state | reads a state background and the base one above it |
| Transparent | alpha 0 not skipped | walks past a transparent background |
| Style block | raw HTML read | reads no element out of a style block |
| Pair shield | shield removed | reads an element a pair targets by that pair alone |
| State not shielded | state colours shielded again | reads a state's colour on the background of the pair that targets its element |
| Attribute filter | attribute names ignored | restricts an attribute filter to the elements carrying that attribute |
| Unreadable background | walk not stopped | stops at a background it cannot read |

## Limits

- Haiku runs the pilot; Kairos was not rerun, its C3 after the change is not measured.
- Four negative cases were shown red by their mutation only, not before their code.
