# Token optimization for AI IDEs

**Goal:** Cut token usage and cost in AI coding assistants without losing output quality.

## Why optimize your tokens

**Token usage** is the bill — every turn re-sends your whole **context window** and you pay for it again.

Most of it is **waste**: filler prose, noisy logs, stale context, bloated instruction files.

Reach for this recipe when **cost** climbs faster than your output.

## Steps to cut token usage

### 🟢 Beginner

#### 1) 🔎 See what fills the window — `/context`

`/context` paints your context as a grid, so you cut the biggest consumers instead of guessing.

- Run `/context` in Claude Code.
- Read the grid and find the heavy blocks: tool schemas, instruction files, long file reads.
- Attack the biggest block first.

```text
$ /context
  MCP tool schemas   ████████████  28%   ← biggest, cut first
  file reads         ████████      19%
  CLAUDE.md          ████          9%
  system + tools     ███████████   …
(illustrative — paste your real /context here)
```

#### 2) 💸 Read the bill — `/cost`

`/cost` tells you what a session actually costs and where the spend goes.

- Run `/cost` (alias `/usage`).
- Read the breakdown by skill, subagent, and MCP server.
- Re-run it after a change to confirm the spend really dropped.

```text
$ /cost
  Session: $0.42 · 1.2M tokens
  By: subagents 38% · MCP 21% · main 41%
(illustrative — paste your real /cost here)
```

#### 3) 🔍 Find your bad habits — `/insights`

`/insights` analyses how you prompt — which is probably sub-optimal — so you fix the pattern, not one prompt.

- What you repeat every session → move it into the knowledge base (`CLAUDE.md`, rules).
- Counter-intuitive habits you never noticed → surfaced so you can drop them.

```text
$ /insights
  • You restate the test command in ~60% of sessions → put it in CLAUDE.md
  • Long "summary" turns inflate output → ask for terse replies
(illustrative — paste your real /insights here)
```

#### 4) 📈 Track per-prompt with an analytics tool

Built-ins show one session; an analytics tool reads all your local logs and reveals where the bill truly sits.

- Several exist: [`prompt-analytics-for-claude-code`](https://github.com/romainfjgaspard/prompt-analytics-for-claude-code) and [`ccusage`](https://www.npmjs.com/package/ccusage).
- Run one against your local history — no setup, it parses `~/.claude`.
- The lesson it surfaces: **cache reads dwarf input + output**, so caching, not generation, is most of the bill.

```text
$ uvx --from prompt-analytics-for-claude-code prompt-analytics summary
  Input tokens        ~8M
  Output tokens       ~22M
  Cache read tokens   ~4.5B    ← dominates the total
  Source: live parse of ~/.claude/projects
(real run, token volumes rounded; cost figures omitted)
```

#### 5) ✂️ Trim your instruction file

Your instruction file ships every turn, so each cut line saves on every message.

- It lives at `CLAUDE.md` (or `.github/copilot-instructions.md`).
- Cut it to essentials and add explicit conciseness rules.
- Reuse the [`claude-token-efficient`](https://github.com/drona23/claude-token-efficient) ruleset.

```md
# CLAUDE.md
- Terse answers. No preamble, no "Let me…", no closing summary.
- Keep verbatim: code, quoted errors, security warnings. Cut the rest.
```

#### 6) 🗜️ Compact deliberately

Compacting on your terms keeps what matters instead of letting auto-compaction guess.

- Watch context use and act around 60–70%.
- Run `/compact` with focus instructions naming what to keep.

```text
$ /compact keep the repro steps and the failing test; drop the file dumps
```

### 🟡 Intermediate

#### 7) 🗣️ Make the agent talk less

Output is repetition you pay to generate, so cap the chatter.

- Install the [`caveman`](https://github.com/JuliusBrussee/caveman) skill (auto-detects 30+ agents).
- It forces short, filler-free replies (reported ~65% output cut, code intact).

```text
before: "Great question! Let me walk you through each step involved…"
after:  "3 steps:"
```

#### 8) 🧹 Filter noisy command output

Test, install, and build logs flood context with lines the model never needs.

- Install a CLI proxy: [`RTK`](https://github.com/rtk-ai/rtk) (Rust) or [`SNIP`](https://github.com/edouard-claude/snip) (Go, YAML filters).
- Run noisy commands through it; it keeps only the signal (reported 60–90%).

```bash
$ rtk proxy npm test
# full build log in → only failures + final summary kept
```

#### 9) 🔌 Prefer CLI over MCP

An MCP server loads its full schema every turn, while a CLI costs tokens only when called.

- Use the CLI when one exists (`gh`, `acli`, …); keep MCP for what has none.
- See [`mcp-installation.md`](mcp-installation.md).

```bash
$ gh pr list   # a few tokens per call, vs a GitHub MCP schema riding along every turn
```

### 🔴 Expert

#### 10) 📚 Use progressive disclosure

Load knowledge only when the task needs it, instead of riding along every turn.

- Install an AIDD framework so skills, rules, and runbooks load on demand.

```text
skill description matched → its steps load
no match → 0 tokens spent
```

#### 11) 🎯 Route by difficulty

The top model on routine work is wasted spend.

- Send research and boilerplate to a cheaper model or a fresh subagent.
- Reserve the strongest model for hard reasoning.

```text
research / boilerplate → small model or subagent
architecture / tricky bug → top model
```

#### 12) ✅ Cap extended thinking

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
- Tools: [`prompt-analytics-for-claude-code`](https://github.com/romainfjgaspard/prompt-analytics-for-claude-code) · [`ccusage`](https://www.npmjs.com/package/ccusage) · [`caveman`](https://github.com/JuliusBrussee/caveman) · [`RTK`](https://github.com/rtk-ai/rtk) · [`SNIP`](https://github.com/edouard-claude/snip) · [`claude-token-efficient`](https://github.com/drona23/claude-token-efficient)
