# Token optimization for AI IDEs

> **Goal:** Cut token usage and cost in AI coding assistants without losing output quality.

|                   |                                                                              |
| ----------------- | ---------------------------------------------------------------------------- |
| **Level**         | Intermediate                                                                 |
| **Time**          | ~15 min                                                                      |
| **Prerequisites** | An AI coding assistant (Claude Code, GitHub Copilot, Codex, Cursor, …); a terminal |

## Why

Tokens are the bill. Every turn re-sends your context window — instructions, file reads, command output, the model's own narration — and you pay for all of it, every time. Most of it is waste: filler prose, noisy logs, stale context, oversized instruction files. The tips below attack each source. Stack them and large savings are realistic; every percentage here is **as reported by the tool**, not an independent benchmark.

> **Measure before you optimise.** You cannot cut what you do not see.

## Best tips

Ranked by impact-to-effort. Start at the top.

#### 1) Measure first

You cannot improve what you do not track, and the bill is rarely where you think — cache reads usually dominate, not generation.

- In Claude Code: `/context` shows what fills the window, `/cost` shows the session cost and plan usage, `/insights` reports your session patterns and friction points.
- For a per-prompt breakdown across every session, use [`prompt-analytics-for-claude-code`](https://github.com/romainfjgaspard/prompt-analytics-for-claude-code).

```bash
$ uvx --from prompt-analytics-for-claude-code prompt-analytics summary
# per-prompt tokens & cost from your local logs — cache reads dominate the total
```

#### 2) Trim your instruction file

`CLAUDE.md` (or `.github/copilot-instructions.md`) ships in **every** turn, so each wasted line is taxed on every message.

- Keep it short; add explicit conciseness rules.
- Drop-in ruleset: [`drona23/claude-token-efficient`](https://github.com/drona23/claude-token-efficient) (savings vary by model; measure your own).

```md
# CLAUDE.md
- Terse answers. No preamble, no "Let me…", no closing summary.
- Keep verbatim: code, quoted errors, security warnings. Cut the rest.
```

#### 3) Make the agent talk less

Output is repetition — "Let me explain…", "Here's a summary…". You pay to generate every word.

- The [`caveman`](https://github.com/JuliusBrussee/caveman) skill forces short, filler-free replies (reported ~65% output-token cut, code and data intact). Auto-detects 30+ agents.

```text
before: "Great question! Let me walk you through each of the steps involved…"
after:  "3 steps:"
```

#### 4) Filter noisy command output

Test runs, installs, and build logs flood the context with lines the model never needs.

- A CLI proxy strips them before they land: [`RTK`](https://github.com/rtk-ai/rtk) (Rust) or [`SNIP`](https://github.com/edouard-claude/snip) (Go, YAML filters). Both report 60–90% on noisy output, zero overhead when no filter matches.

```bash
$ rtk proxy npm test
# full build log in → only failures + final summary kept
```

#### 5) Prefer CLI over MCP

An MCP server loads its full tool schema into **every** turn; a CLI call costs a few tokens only when you use it.

- Reach for the CLI when one exists; keep MCP for what truly needs it. See [`mcp-installation.md`](mcp-installation.md).

```bash
$ gh pr list        # a few tokens per call
# vs a GitHub MCP server: its whole schema rides along every turn
```

#### 6) Use progressive disclosure

Don't paste big procedural docs into context. Load knowledge only when the task needs it.

- Install an AIDD framework so skills, rules, and runbooks load on demand instead of riding along every turn.

```text
skill description matched → its steps load
no match → 0 tokens spent
```

#### 7) Compact deliberately

Auto-compaction fires late and may drop what you wanted kept.

- Run `/compact` around 60–70% context, passing focus instructions for what to retain.

```bash
$ /compact keep the repro steps and the failing test; drop the file dumps
```

#### 8) Route by difficulty

The top model on a routine task is wasted spend.

- Send research and routine work to a cheaper/faster model or a fresh subagent context; reserve the strongest model for the hard reasoning.

```text
research / boilerplate → small model or subagent
architecture / tricky bug → top model
```

#### 9) Cap extended thinking

Extended reasoning can silently add thousands of tokens per turn on tasks that don't need it.

- Control it with `MAX_THINKING_TOKENS` in your settings — set `0` to turn extended thinking off when you don't need it. See the [Claude Code settings docs](https://code.claude.com/docs/en/settings).

```bash
# settings.json (env)
"MAX_THINKING_TOKENS": "0"   # disable extended thinking for routine work
```

## Verify

- Run `/cost` (or `prompt-analytics summary`) before and after a typical task — the token count should drop measurably.
- `/context` shows your instruction file and tool schemas taking a smaller share of the window.
- A noisy command (test suite, `npm install`) routed through RTK or SNIP returns far fewer lines than the raw run.

## Related

- [`mcp-installation.md`](mcp-installation.md) — why CLI beats MCP for context efficiency
- [Anthropic — Claude Code costs](https://code.claude.com/docs/en/costs) · [settings](https://code.claude.com/docs/en/settings)
- Tools: [`prompt-analytics-for-claude-code`](https://github.com/romainfjgaspard/prompt-analytics-for-claude-code) · [`caveman`](https://github.com/JuliusBrussee/caveman) · [`RTK`](https://github.com/rtk-ai/rtk) · [`SNIP`](https://github.com/edouard-claude/snip) · [`claude-token-efficient`](https://github.com/drona23/claude-token-efficient)
