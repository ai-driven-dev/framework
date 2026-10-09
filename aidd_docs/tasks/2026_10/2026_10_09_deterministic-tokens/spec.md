---
status: framed
branch: feat/telemetry-deterministic-tokens
---

# Deterministic token measurement, release 1

## Target

On a machine running Claude Code, every billed model call is counted exactly once and can be
broken down by person, session, model, period, repository, task and ticket, the task and ticket
coming only from what a person declared, with the previous telemetry removed entirely.

## Hard constraints

- The previous telemetry is removed, not adapted: its journal, its hooks, its records and
  their stored format, its report envelope, its commands and checks, the backlog link a task
  folder declares, the step markers skills emit, and the commit trailer. Nothing of it is read,
  migrated or kept compatible.
- Removal never breaks a user's repository. Opting in with the new version removes what the
  previous one left in that repository (the commit hook line together with its script, the run
  journal and its ignore entry); forgetting also removes the previous version's stored
  measurement and identity. A commit hook line pointing at a missing script fails every commit
  (measured), so the line and its script are only ever removed together.
- Counting is deterministic: the same transcripts give the same totals on every run, in any
  order, read once or many times. Each billed call is counted once, whichever copies of it the
  tool wrote (streaming snapshots, resumed sessions, sub-agents, advisor calls).
- Input, output, cache read and cache write are always reported apart. An unknown value is
  unknown, never zero. A shape the reader does not recognise is reported, never guessed.
- One per-tool reader turns a tool's own files into a common usage record; everything after
  it (storage, attribution, report, export) is written once for every tool.
- A task and its ticket are known only from an explicit declaration by a command. No branch
  name, folder name, commit message or prompt text is ever parsed to guess one.
- The declaration is asked for at most once per working branch, only of a person present, and
  before any token of that work is spent, on every surface where a person can be present
  (terminal, IDE extension, desktop app), including those without a shell mode. Answering is
  never itself blocked and never reaches the model. A session with nobody present, or whose
  presence is unknown, is never blocked.
- A session started by `/clear` keeps the task of the session it replaced, says so to the
  person, and a later declaration in it re-attributes the whole session.
- Work with no declared task is its own row, with the reason it has none, and is attributed
  retroactively once its branch is declared.
- Every breakdown of a period sums to the same total.
- A project or person that has not opted in is untouched: nothing stored, nothing asked,
  nothing blocked. Without the plugin, nothing changes at all.
- Data stays on the machine: release 1 sends nothing anywhere.
- The person identity is a fresh, separate opt-in, located with the rest of the person's aidd
  configuration; the previous identity file is not carried over.
- Public repository: no real session id, prompt, machine path or personal name in any fixture.
- Every rule ships with the test that failed first and the mutation that proves the test.
- All gates green, Windows included.

## Non-goals

- Codex, Copilot, Cursor, opencode and Kilo measurement. Their measurement disappears with the
  previous telemetry until their own reader lands; the common record already admits them.
- Amounts in currency: the destination owns the price table (decision record of 2026-09-01).
- Sending anything to the hosted destination (Gouvernail), or defining its record: designed
  later, with the destination.
- Aggregating across machines or people: the destination's job.
- Cloud sessions, whose transcripts are not on the machine.
- Step, skill, flow, prompt and produced-file breakdowns.
- Guessing the task from the work itself.

## Done-when

- No trace of the previous telemetry remains in the shipped product, its tests or its docs,
  except completed task folders kept as history, and pending ones are marked superseded.
- A user who had the previous version enabled can still commit before and after opting in
  again; after opting in, nothing the previous version left remains in that repository, and
  after forgetting, nothing remains in their profile either.
- On the shared fixtures, every counting rule gives the expected per-call record, and breaking
  any one rule turns its own test red.
- On real local history, the release's daily totals equal an independent reference count of
  the same transcripts, the known reference under-count of cache writes aside and explained.
- A person present on an unbound working branch, on every surface where presence is
  detectable (the terminal at least), cannot get a model answer until they declare a task or declare none, and the declaration itself costs no model
  call; the default branch and a detached HEAD never ask.
- A headless run on the same branch completes unblocked and its tokens land on the branch's
  task, or on the unattributed row until the branch is declared, then on the task.
- After `/clear`, the new session's tokens land on the carried task, and a declaration made in
  it moves all of them.
- A report for a period shows tokens per person, session, model, day, repository, task and
  ticket, four counters apart, every axis summing to the same total, unattributed work on its
  own row with its reason.
- A project that never opted in shows no prompt, no block, and nothing stored.

## Open Questions

None.

## Stakeholders

- Decider: the maintainer who framed release 1.
- Owner: the aidd-telemetry plugin and the `aidd` CLI.
- Consumer: developers using Claude Code with the plugin; the Gouvernail destination.

## Context

- Measurements, verified behaviours and the target shape: [`context/target.md`](context/target.md).
- The common usage record and per-tool normalisation: [`context/usage-record-contract.md`](context/usage-record-contract.md).
- Prototype readers and their mutation-proved fixtures: [`context/prototype/`](context/prototype/).
- Decision records kept: [hosted destination](../../../memory/internal/decisions/measurement-may-reach-a-hosted-destination.md),
  [price table](../../../memory/internal/decisions/a-price-table-is-the-destination-s.md).
