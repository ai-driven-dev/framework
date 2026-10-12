# skill-eval

Behavioral eval harness for framework skills. Runs each skill through the
selected host CLI and checks the outcomes described by its action `## Test`
blocks. These cases are live agent evaluations, not offline unit tests.

## Run

```bash
node scripts/skill-eval.mjs                 # every case, deterministic checks
node scripts/skill-eval.mjs 03-shadow-areas # one skill
node scripts/skill-eval.mjs --judge         # also run LLM-judge criteria (metered)
node scripts/skill-eval.mjs --keep          # keep temp dirs to inspect
node scripts/skill-eval.mjs aidd-context --host=codex --case="Kilo native skill"
```

Local and opt-in. The default `--host=claude` needs an authenticated Claude CLI.
`--host=codex` uses an authenticated Codex CLI and the same case contracts. Both
spend tokens, so neither is a CI gate. `--judge` runs each natural-language
criterion with the selected host. Without `--judge`, deterministic checks can
pass while the case is marked `INCOMPLETE (judge skipped)`; that is not a
successful judge evaluation.

No model override is passed unless you supply `--model=<model-id>`.

## How it works

Each case runs in a throwaway temp project. The skill under test is copied into
`.claude/skills/<evalName>/` for Claude or `.agents/skills/<evalName>/` for
Codex. Its frontmatter `name` is rewritten to a unique `xeval-*` value, so the
worktree copy is selected. The harness writes case setup files, runs the host
in that project, then checks the written files and final response. A nonzero
host exit fails the case. `--keep` retains the temp project for inspection.

## Cases

`cases.json` holds the cases. Each one:

```json
{
  "skill": "03-shadow-areas",
  "evalName": "xeval-shadow",
  "name": "short description",
  "setup": { "files": { "prd.md": "..." } },
  "prompt": "Use the {{SKILL}} skill on ./prd.md ...",
  "expect": {
    "filesExist": ["prd-shadow-report.md"],
    "jsonValid": [".claude/settings.json"],
    "fileMatches": { ".claude/settings.json": "SessionStart" },
    "fileContains": { "prd-shadow-report.md": ["## Gaps by Category"] },
    "fileNotContains": { "report.md": ["..."] },
    "projectTreeUnchanged": true,
    "stdoutContains": ["..."],
    "stdoutNotContains": ["tier 1"],
    "stdoutMatches": ["\\d+%"],
    "judge": "natural-language criterion, only checked under --judge",
    "judgeFiles": ["prd-shadow-report.md"]
  }
}
```

`{{SKILL}}` is replaced with the case `evalName`. `jsonValid` checks files parse
as JSON, `fileMatches` checks their text against regular expressions, and
`projectTreeUnchanged` checks that the run added, removed, or changed no project
files (the Codex final-response file is excluded). Deterministic checks run
always; `judge` criteria run only with `--judge` and use a second invocation of
the selected host. Its verdict and one-line reason are shown in the case output.

## Coverage and limits

- Deterministic where possible (file written, filename rule, required sections,
  hedged unverified claim, forbidden mechanics absent). Fuzzy outcomes
  (claim-extraction quality, terseness) go to `--judge` and can flake.
- `01-brainstorm` is interactive (multi-turn Q&A) and is not covered here; a
  single headless turn cannot exercise its loop.

## Known findings

The harness surfaced one limitation worth tracking:

- **empty-source scanning varies.** Most runs produce exactly one blocker, but
  the exact count/header drifts between runs. The case asserts deterministically
  only that a report is written, and gates the "exactly one blocker" semantics
  behind `--judge`.
