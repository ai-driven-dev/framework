← [aidd-framework](../../README.md)

# aidd-telemetry

Measure tokens by skill, step and task.

> Beta. Proven end to end on Claude Code; other tools depend on their recorded data.
> Excluded from curated installation pending validation on other users' machines.

## What it is

Reports attribute usage to work, with explicit evidence:

- `stated by the tool`: exact attribution.
- `from a journal interval`: inferred attribution.
- `unattributed`: neither source identifies a step; it does not mean no step ran.

Unknown values remain unknown, never zero. Reports count tokens; a separate service prices them.

## Why it exists

Providers meter accounts; AIDD identifies skills, steps, tasks and flows. Measurement is
opt-in, local, and excludes prompts, diffs and code.

## How it works

```mermaid
flowchart LR
  Tool["Your AI tool<br/>(Claude Code, Codex, Copilot, OpenCode, Cursor)"]
  Hooks["Plugin hooks<br/>node, no dependency"]
  Journal["Run journal<br/>aidd_docs/runs/*.jsonl<br/>which skill ran, when, which task folder"]
  Transcript["The tool's own transcript<br/>tokens and model, no AIDD knowledge"]
  CLI["aidd telemetry report"]
  Store["Figures<br/>~/.config/aidd/telemetry/"]
  Answer["tokens per step, task, flow, model, person"]

  Tool -->|"SessionStart, PostToolUse, Stop"| Hooks -->|append one line| Journal
  Tool -->|writes itself| Transcript
  Journal --> CLI
  Transcript --> CLI
  CLI -->|joins by session, keeps a record| Store --> Answer
```

- **Hooks** append one line per observation to git-ignored
  `aidd_docs/runs/<run_id>__<vendor_id>.jsonl`. Journals are never rewritten and contain no
  tokens, cost or model.
- **Tools** write transcripts in their own locations and formats: tokens without AIDD skills.
- **`aidd telemetry report`** joins both by session and stores results under
  `~/.config/aidd/telemetry/`. Reporting cannot run live: hooks fire before turn tokens are
  durably written.

Recording requires only `node`, even without `aidd`. Enabling measurement and computing
reports require the CLI.

## Getting started

```sh
npm install -g @ai-driven-dev/cli
aidd plugin install aidd-telemetry
```

Ask your AI tool for a skill. Each stops with an explanation if `aidd` cannot answer.

| Ask your tool for | It runs | You get |
| --- | --- | --- |
| `00-init` | `aidd telemetry on`, then reads a run file back | project opt-in and recording proof |
| `01-cost` | `aidd telemetry report` | period or task usage by step, model, task, flow, tool or person |
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
- **Counts:** raw transcript tokens differ from vendor usage screens, which weight cached
  tokens by price. Neither count is wrong.
- **Periods:** work time, not billing time. Activity before opt-in cannot be reconstructed.

## Privacy

- **No export.** `aidd telemetry check` and `aidd telemetry off` detect legacy
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
