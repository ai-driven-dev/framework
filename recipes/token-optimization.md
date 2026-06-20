# Token optimization for AI IDEs

> **Goal:** Cut token usage and cost in AI coding assistants without losing output quality.

|                   |                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------- |
| **Level**         | Intermediate                                                                       |
| **Prerequisites** | An AI coding assistant (Claude Code, GitHub Copilot, Codex, Cursor, …); a terminal |

## Why

**Token usage** is the bill. Every turn re-sends your whole **context window** — instructions, file reads, command output, narration — and you pay for it again. Most of it is waste: filler prose, noisy logs, stale context, bloated instruction files. Reach for this recipe when **cost** climbs faster than output.

## Steps to cut token usage

### 🟢 Beginner

#### 1) 📊 Measure first

You cannot cut what you cannot see, so find what fills the window before changing anything.

- Built-in: run `/context`, `/cost`, and `/insights` in Claude Code.
- Cross-session detail: install [`prompt-analytics-for-claude-code`](https://github.com/romainfjgaspard/prompt-analytics-for-claude-code) and run it with `uvx`.

```bash
$ uvx --from prompt-analytics-for-claude-code prompt-analytics summary
# per-prompt tokens & cost from local logs — cache reads usually dominate
```

#### 2) ✂️ Trim your instruction file

Your instruction file ships every turn, so each cut line saves on every message.

- It lives at `CLAUDE.md` (or `.github/copilot-instructions.md`).
- Cut it to essentials and add explicit conciseness rules.
- Reuse the [`claude-token-efficient`](https://github.com/drona23/claude-token-efficient) ruleset.

```md
# CLAUDE.md
- Terse answers. No preamble, no "Let me…", no closing summary.
- Keep verbatim: code, quoted errors, security warnings. Cut the rest.
```

#### 3) 🗜️ Compact deliberately

Compacting on your terms keeps what matters instead of letting auto-compaction guess.

- Watch context use and act around 60–70%.
- Run `/compact` with focus instructions naming what to keep.

```bash
$ /compact keep the repro steps and the failing test; drop the file dumps
```

### 🟡 Intermediate

#### 4) 🗣️ Make the agent talk less

Output is repetition you pay to generate, so cap the chatter.

- Install the [`caveman`](https://github.com/JuliusBrussee/caveman) skill (auto-detects 30+ agents).
- It forces short, filler-free replies (reported ~65% output cut, code intact).

```text
before: "Great question! Let me walk you through each step involved…"
after:  "3 steps:"
```

#### 5) 🧹 Filter noisy command output

Test, install, and build logs flood context with lines the model never needs.

- Install a CLI proxy: [`RTK`](https://github.com/rtk-ai/rtk) (Rust) or [`SNIP`](https://github.com/edouard-claude/snip) (Go, YAML filters).
- Run noisy commands through it; it keeps only the signal (reported 60–90%).

```bash
$ rtk proxy npm test
# full build log in → only failures + final summary kept
```

#### 6) 🔌 Prefer CLI over MCP

An MCP server loads its full schema every turn, while a CLI costs tokens only when called.

- Use the CLI when one exists (`gh`, `acli`, …); keep MCP for what has none.
- See [`mcp-installation.md`](mcp-installation.md).

```bash
$ gh pr list   # a few tokens per call, vs a GitHub MCP schema riding along every turn
```

### 🔴 Expert

#### 7) 📚 Use progressive disclosure

Load knowledge only when the task needs it, instead of riding along every turn.

- Install an AIDD framework so skills, rules, and runbooks load on demand.

```text
skill description matched → its steps load
no match → 0 tokens spent
```

#### 8) 🎯 Route by difficulty

The top model on routine work is wasted spend.

- Send research and boilerplate to a cheaper model or a fresh subagent.
- Reserve the strongest model for hard reasoning.

```text
research / boilerplate → small model or subagent
architecture / tricky bug → top model
```

#### 9) ✅ Cap extended thinking

Extended reasoning can silently add thousands of tokens on tasks that don't need it.

- Set `MAX_THINKING_TOKENS` to `0` for routine work.
- See the [Claude Code settings docs](https://code.claude.com/docs/en/settings).

```bash
# settings.json (env)
"MAX_THINKING_TOKENS": "0"   # disable extended thinking for routine work
```

## Verify

- Run `/cost` before and after a typical task — the token count drops measurably.
- `/context` shows your instruction file and tool schemas taking a smaller share of the window.
- A noisy command routed through RTK or SNIP returns far fewer lines than the raw run.

## Related

- [`mcp-installation.md`](mcp-installation.md) — why CLI beats MCP for context efficiency
- [Anthropic — Claude Code costs](https://code.claude.com/docs/en/costs) · [settings](https://code.claude.com/docs/en/settings)
- Tools: [`prompt-analytics-for-claude-code`](https://github.com/romainfjgaspard/prompt-analytics-for-claude-code) · [`caveman`](https://github.com/JuliusBrussee/caveman) · [`RTK`](https://github.com/rtk-ai/rtk) · [`SNIP`](https://github.com/edouard-claude/snip) · [`claude-token-efficient`](https://github.com/drona23/claude-token-efficient)
