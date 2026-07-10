# Onboard — headless runs, every state

Each block is the verbatim output of `claude -p "onboard me"` in a purpose-built fixture.
Generated 2026-07-10 10:43.

### 01-greenfield

> Empty repo, git only. No code, no memory, no tool config.

```text
```
 █████╗ ██╗██████╗ ██████╗
██╔══██╗██║██╔══██╗██╔══██╗
███████║██║██║  ██║██║  ██║
██╔══██║██║██║  ██║██║  ██║
██║  ██║██║██████╔╝██████╔╝
╚═╝  ╚═╝╚═╝╚═════╝ ╚═════╝
 AI-Driven Development 🇫🇷

👋  Welcome. AIDD guides a project from first setup to shipped code, one step at a time.

Your AIDD setup:
  AI tools   none yet
  Plugins    aidd-context · aidd-dev · aidd-pm · aidd-refine · aidd-vcs · aidd-orchestrator   ✅
  Memory     ❌ not set up yet

Empty repo — greenfield. Three foundation steps before the dev flow opens.

Foundations — step 1 of 3

  tech stack        design and validate the architecture into INSTALL.md
                    (every later step reads this)

  step 2   project memory — capture the project knowledge into aidd_docs/memory/
  step 3   memory wiring — load that knowledge into your AI tool's context file

👉  Type [1] to start.   skip [s] · what's this [?]   ·   OK walks all 3   ·   flow [m]
```
```

### 02-existing-no-memory

> Code present, no memory bank. The memory-first path.

```text
```txt
 █████╗ ██╗██████╗ ██████╗
██╔══██╗██║██╔══██╗██╔══██╗
███████║██║██║  ██║██║  ██║
██╔══██║██║██║  ██║██║  ██║
██║  ██║██║██████╔╝██████╔╝
╚═╝  ╚═╝╚═╝╚═════╝ ╚═════╝
 AI-Driven Development 🇫🇷
```

👋  Welcome. AIDD gives your project a memory, then a flow to ship features through.

Your AIDD setup:
```txt
  AI tools   none yet
  Plugins    aidd-context · aidd-dev · aidd-pm · aidd-refine · aidd-vcs   ✅
  Memory     ❌ not set up yet
```

Code exists, memory does not. AI reads project fresh every session.

**Foundations — step 1 of 2**
```txt
  project knowledge saved    read codebase, write memory bank
                             (AI stop guessing your stack, structure, conventions)

  step 2   knowledge loaded by the AI — wire memory into your AI tool's context file
```

👉  Type **[1]** to start.   skip [s] · what's this [?]   ·   OK walks both   ·   flow [m]
```

### 03-drift-tool-unwired

> Memory wired for claude. .codex/ present with no AGENTS.md.

```text
```txt
 █████╗ ██╗██████╗ ██████╗
██╔══██╗██║██╔══██╗██╔══██╗
███████║██║██║  ██║██║  ██║
██╔══██║██║██║  ██║██║  ██║
██║  ██║██║██████╔╝██████╔╝
╚═╝  ╚═╝╚═╝╚═════╝ ╚═════╝
 AI-Driven Development 🇫🇷

👋  AIDD walks your project from setup to shipped code, one step at a time.

Your AIDD setup:
  AI tools   codex  ❌
  Plugins    aidd-context · aidd-dev · aidd-pm · aidd-refine · aidd-vcs   ✅
  Memory     aidd_docs · 8 synced ✅

⚠️  Memory written, but codex can't read it — no AGENTS.md carries the memory block.
   → Type [1] to wire memory into codex.

👉  Type [1] to start.   skip [s] · what's this [?]   ·   flow [m]
```
```

### 04-drift-block-offshape

> Memory bank synced, but the CLAUDE.md block is off canonical shape.

```text
```txt
 █████╗ ██╗██████╗ ██████╗
██╔══██╗██║██╔══██╗██╔══██╗
███████║██║██║  ██║██║  ██║
██╔══██║██║██║  ██║██║  ██║
██║  ██║██║██████╔╝██████╔╝
╚═╝  ╚═╝╚═╝╚═════╝ ╚═════╝
 AI-Driven Development 🇫🇷

👋  AIDD guides your project from setup to shipped code. Here is where you stand.

Your AIDD setup:
  AI tools   none yet
  Plugins    aidd-context · aidd-dev · aidd-pm · aidd-refine · aidd-vcs   ✅
  Memory     aidd_docs · 8 synced   ✅

Foundations are met. Nothing is in flight. Your code has no tests.

👉  Next: cover src/ with tests   [1]
    start new work [2]  ·  audit [3]  ·  explore [4]  ·  what's this [?]   ·   flow [m]
```
```

### 05-midwork

> Full setup, plan status: in-progress, an uncommitted file.

```text
🔍  Mid-work. Plan `demo` is `in-progress` — code started (`src/wip.js` untracked), not yet asserted.

```txt
  Flow:  brainstorm ✅ → spec* → plan ✅ → [implement] → assert → review → commit → PR

  Setup:  AI tools   claude ✅
          Memory     aidd_docs · 8 synced ✅
```

👉  Next: finish implementing the plan   `[1]`
    assert instead `[2]`  ·  no tests in repo, add coverage `[3]`  ·  flow `[m]`  ·  what's this `[?]`
```

### 06-idle

> Full setup, everything committed, nothing pending.

```text
```txt
 █████╗ ██╗██████╗ ██████╗
██╔══██╗██║██╔══██╗██╔══██╗
███████║██║██║  ██║██║  ██║
██╔══██║██║██║  ██║██║  ██║
██║  ██║██║██████╔╝██████╔╝
╚═╝  ╚═╝╚═╝╚═════╝ ╚═════╝
 AI-Driven Development 🇫🇷

👋  AIDD guides your project from setup to shipped code. Here is where you stand.

Your AIDD setup:
  AI tools   none yet
  Plugins    aidd-context · aidd-dev · aidd-pm · aidd-refine · aidd-vcs · aidd-orchestrator   ✅
  Memory     aidd_docs · 8 synced ✅

Foundations done, no work in flight. Your source has no tests.

👉  Next: add test coverage   [1]
    improve the project [2]  ·  start new work [3]  ·  explore [4]  ·  what's this [?]   ·   flow [m]
```
```

### 07-plan-broken-status

> Full setup, plan.md carries a garbage status field.

```text
🔍  Plan exists but its status is unreadable — flow pinned at `plan`.

```txt
  Flow:  brainstorm ✅ → spec* ✅ → [plan] → implement → assert → review → commit → PR
```

⚠️  `aidd_docs/tasks/2026_07/demo/plan.md` has `status: ??? garbage` — not a valid status, so the flow can't place you.
   Valid: `pending` · `in-progress` · `implemented` · `reviewed` · `blocked`

→  Type **[1]** to repair the status field (you edit it, I show the line).
    re-plan from scratch [2]   ·   what's this [?]   ·   stop
```

### 08-no-vcs

> Code and memory, but no git repository at all.

```text
```txt
 █████╗ ██╗██████╗ ██████╗
██╔══██╗██║██╔══██╗██╔══██╗
███████║██║██║  ██║██║  ██║
██╔══██║██║██║  ██║██║  ██║
██║  ██║██║██████╔╝██████╔╝
╚═╝  ╚═╝╚═╝╚═════╝ ╚═════╝
 AI-Driven Development 🇫🇷

👋  AIDD guides your project from setup to shipped code. Here is where yours stands.

Your AIDD setup:
  AI tools   none yet
  Plugins    aidd-context · aidd-dev · aidd-pm · aidd-refine · aidd-vcs   ✅
  Memory     aidd_docs · 8 synced   ✅

Foundations met. Code in src/, no tests yet, and no version control — so no review or pull-request stage to read.

👉  Next: cover src/ with tests   [1]
    init the repo [2]   ·   audit the code [3]   ·   what's this [?]   ·   flow [m]
```
```

CAPTURE_DONE
