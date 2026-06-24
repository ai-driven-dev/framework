# skill-eval

Behavioral eval harness for the `aidd-refine` skills. Runs each skill for real
through a headless `claude -p` and asserts the outcomes its action `## Test`
blocks describe.

## Run

```bash
node scripts/skill-eval.mjs                 # every case, deterministic checks
node scripts/skill-eval.mjs 04-shadow-areas # one skill
node scripts/skill-eval.mjs --judge         # also run LLM-judge criteria (metered)
node scripts/skill-eval.mjs --keep          # keep temp dirs to inspect
```

Local and opt-in. Needs an authenticated `claude` CLI and spends tokens, so it
is not a CI gate.

## How it works

Each case runs in a throwaway temp project. The skill under test is copied into
`.claude/skills/<evalName>/` and its frontmatter `name` is rewritten to a unique
`xeval-*` value. The unique name guarantees the worktree copy runs, never a
globally-installed plugin of the same name. The harness writes the case setup
files, runs `claude -p` in that project, then checks the written files and the
output.

## Cases

`cases.json` holds the cases. Each one:

```json
{
  "skill": "04-shadow-areas",
  "evalName": "xeval-shadow",
  "name": "short description",
  "setup": { "files": { "prd.md": "..." } },
  "prompt": "Use the {{SKILL}} skill on ./prd.md ...",
  "expect": {
    "filesExist": ["prd-shadow-report.md"],
    "fileContains": { "prd-shadow-report.md": ["## Gaps by Category"] },
    "fileNotContains": { "report.md": ["..."] },
    "stdoutContains": ["..."],
    "stdoutNotContains": ["tier 1"],
    "stdoutMatches": ["\\d+%"],
    "judge": "natural-language criterion, only checked under --judge",
    "judgeFiles": ["prd-shadow-report.md"]
  }
}
```

`{{SKILL}}` is replaced with the case `evalName`. Deterministic checks run
always; `judge` criteria run only with `--judge` and use a second `claude -p`
as grader, for outcomes that cannot be matched literally.

## Coverage and limits

- Deterministic where possible (file written, filename rule, required sections,
  hedged unverified claim, forbidden mechanics absent). Fuzzy outcomes
  (claim-extraction quality, terseness) go to `--judge` and can flake.
- `01-brainstorm` is interactive (multi-turn Q&A) and is not covered here; a
  single headless turn cannot exercise its loop.

## Known findings

The harness surfaced two limitations worth tracking:

- **condense's `Condense: ON (<level>).` line is model-emitted, not guaranteed.**
  `02-stats` and the `condense-stats.js` hook parse that exact line from the
  transcript, but the model paraphrases it ("Condense mode on, level full")
  even when the action mandates the literal. So the condense case gates on
  semantics (mentions condense + the level), not the literal, and stats
  detection is best-effort. A robust fix would emit the marker from the hook
  rather than rely on model output.
- **empty-source scanning varies.** Most runs produce exactly one blocker, but
  the exact count/header drifts between runs. The case asserts deterministically
  only that a report is written, and gates the "exactly one blocker" semantics
  behind `--judge`.
