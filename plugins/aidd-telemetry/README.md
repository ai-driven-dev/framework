← [aidd-framework](../../README.md)

# aidd-telemetry

See which skills and tasks consume tokens, then choose where to improve your workflow.

> Beta. Proven end to end on Claude Code; other tools depend on their recorded data.
> Excluded from curated installation pending validation on other users' machines.

## What it is

Usage reports group work by step, model, task, flow, tool or person. Each attribution states
its evidence:

- `stated by the tool`: exact attribution.
- `from a journal interval`: inferred attribution.
- `unattributed`: neither source identifies a step; it does not mean no step ran.

Unknown values remain unknown, never zero. Reports count tokens; a separate service prices them.

## Why it exists

Provider totals describe accounts. AIDD connects those counts to your units of work.

## How it works

```mermaid
flowchart LR
  Journal["Hook journal: work observed"] --> Report["aidd telemetry report: join by session"]
  Transcript["Tool transcript: tokens and model"] --> Report
  Report --> Results["Local usage by step, task, flow, model, tool or person"]
```

Hooks append one line per observation to git-ignored
`aidd_docs/runs/<run_id>__<vendor_id>.jsonl`, never rewriting it or recording tokens, cost
or model. Tools write their own transcripts without AIDD skill knowledge. Reports store
joined results under `~/.config/aidd/telemetry/`.

Recording requires only `node`; enabling and reporting require `aidd`. Report after the
turn: hooks fire before its tokens are durably written.

## Getting started

```sh
npm install -g @ai-driven-dev/cli
aidd plugin install aidd-telemetry
```

Enable measurement, work in a session, then report and verify. Use these skills or their
CLI commands; skills stop with an explanation if `aidd` cannot answer.

| Ask your tool for | It runs | You get |
| --- | --- | --- |
| `00-init` | `aidd telemetry on`, then reads a run file back | project opt-in and recording proof |
| `01-cost` | `aidd telemetry report` | period or task usage |
| `02-check` | `aidd telemetry check` | recording status and required repairs |

## Coverage

| Tool | Tokens | Step | Task |
| --- | --- | --- | --- |
| **Claude Code** | ✅ proven on live sessions | ✅ stated by the tool, and by interval | ✅ |
| **Codex** | ✅ on captured rollouts | ✅ by interval | ✅ |
| **OpenCode** | ✅ | ❌ no skill call reaches its plugin | ✅ |
| **Copilot** | ⚠️ session total only, no per-request figure (cumulative at shutdown) | ✅ by interval | ✅ |
| **Cursor** | ❌ no token count in any file it writes | ✅ | ✅ |

- **Codex:** approve each hook entry interactively. Headless runs cannot show the trust
  prompt; sessions record nothing until approval.
- **OpenCode:** supports V1 ≥ 1.18.29 and V2; older V1 lacks the default plugin definition.
  OpenCode V1 can omit the session announcement; the first journalable event then opens it.
  Without a known session directory, it uses the plugin's startup directory, which can be
  wrong for a server serving several projects.
  V2 supplies session directories and journals tool and execution completions through its
  event subscription.
- **OpenCode steps:** only task paths reach the journal, never skill calls. Every request
  remains unattributed by step.
- **Counts:** raw tokens differ from vendor usage screens, which weight cached tokens by
  price. Neither count is wrong.
- **Periods:** work time, not billing time. Activity before opt-in cannot be reconstructed.

## Privacy

- **Local, opt-in recording; no export.** `aidd telemetry check` and `aidd telemetry off` detect legacy
  export endpoints and identify required manual removal.
- **No prompts, code or diffs.** Stored fields follow
  [the record contract](../../aidd_docs/product/metrics-contract.md).
- **Project opt-in:** committing `.aidd/config.json` with measurement enabled affects all
  clones. `AIDD_TELEMETRY=0` unconditionally overrides it for yourself.
- **Retention:** `off` keeps records. `aidd telemetry forget` removes the project's journal,
  this machine's records and identity file; deletion requires `--yes`.
- **Identity:** attach it optionally through `aidd telemetry identity`. Share figures using
  `AIDD_TELEMETRY_DIR`, never `AIDD_USER_CONFIG_DIR`: the latter also relocates `auth.json`
  and its GitHub token.

## Where things are written down

- [`aidd_docs/runs/README.md`](../../aidd_docs/runs/README.md): journal contract.
- [`cost-report-contract.md`](../../aidd_docs/product/cost-report-contract.md): the object
  printed by `report --json`; optional `backlog-link.json` maps a task to its backlog item.
- [`metrics-contract.md`](../../aidd_docs/product/metrics-contract.md): stored records for pricing.
