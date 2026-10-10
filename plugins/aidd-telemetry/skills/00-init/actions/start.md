# Start

Turn measurement on for the current project, once the person has agreed to it.

## Input

The project directory, which must be inside a git repository.

## Output

Measurement is on for the project, or nothing changed and the reason is stated. The person knows what is measured, what they will be asked, and where it stays.

## Process

1. **Explain.** Tell the person, before asking anything:
   - what is measured: the token counts of Claude Code sessions run in this project, read from Claude Code's own session files, split into input, output, cache read and cache write;
   - what is asked: one question per working branch, a task name and optionally a ticket, only when a person is at the keyboard;
   - where it stays: on this machine, and nothing is sent anywhere;
   - whose consent it is: this clone's alone, kept in its git config and never committed, so a teammate is not measured until they run it in theirs.
2. **Ask.** Ask whether to turn measurement on for this project. Wait for an explicit yes.
   - A no, or no answer, ends the action with nothing changed.
3. **Turn on.** Run `aidd telemetry on --yes`. The yes was given in the previous step, so the command's own confirmation is skipped.
   - Outside a git repository, or with a git config git cannot read, the command refuses: show its message and stop.
4. **Report.** Relay everything the command printed, the removals and the warnings included, in the person's words rather than pasted.
   - When it warned that Claude Code keeps session files only briefly, say that older history is lost and give the setting it named.
5. **Prove.** Run `aidd telemetry report --days 1`, and state what it shows.
   - No calls yet is a normal answer for a project that has just opted in: say so, and that the next Claude Code session in this project will be counted.
6. **Tell the rest.** Say that the plugin is what asks about the task and that it needs `node`, and that a task can always be declared by hand with `aidd telemetry task <name> [--ticket <ref>]` or `aidd telemetry task --none`.

## Test

| Case | Pass |
| --- | --- |
| The person says no | No `aidd telemetry on` was run and the project is unchanged |
| The person says yes | `aidd telemetry on --yes` ran once, and the command printed that the clone's consent is set; if it said it removed or deleted a block in `.aidd/config.json`, the person was told that file may need committing |
| `aidd` has no `telemetry` | The skill said so and ran nothing else |
| Run outside a git repository | The refusal was shown and nothing was written |
