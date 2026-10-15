# Start

Turn measurement on for the current project, once the person has agreed to it.

## Input

The project directory, which must be inside a git repository.

## Output

Measurement is on for the project, or nothing changed and the reason is stated. The person knows what is measured, what they will be asked, where it stays, and under which name, if any, they are measured.

## Process

1. **Explain.** Tell the person, before asking anything:
   - what is measured: the token counts of Claude Code sessions run in this project, read from Claude Code's own session files, split into input, output, cache read and cache write;
   - what is asked: one question per working branch, a task name and optionally a ticket, only when a person is at the keyboard;
   - when it starts: now. Measurement starts at the moment it is turned on, and what this project's sessions did before is not counted, whatever Claude Code still holds of it;
   - where it stays: on this machine, and nothing is sent anywhere;
   - whose consent it is: this clone's alone, kept in its git config and never committed, so a teammate is not measured until they run it in theirs.
2. **Ask.** Ask whether to turn measurement on for this project. Wait for an explicit yes.
   - A no, or no answer, ends the action with nothing changed.
3. **Choose the name.** Run `aidd telemetry identity` to read whether an identity is already set.
   - Set: say the person is measured under it, and that the `identity` case changes or removes it. Nothing to ask.
   - Not set: explain that a name only labels the person axis of their own report and stays on this machine, then ask how they want to appear. Offer the name git gives in this project (`git config user.name`, else `git config user.email`) when there is one, another identifier they type, or anonymous. Wait for the answer; never pick for them.
4. **Turn on.** The yes was given in step 2, so the command's own confirmation is skipped:
   - identity already set: `aidd telemetry on --yes`;
   - a name chosen: `aidd telemetry on --yes --as <id>`, with exactly the text chosen;
   - anonymous: `aidd telemetry on --yes --anonymous`. Staying anonymous is not stored: the next `on`, in another clone, asks again.
   - Outside a git repository, with a git config git cannot read, or with an identifier over 128 characters or spanning lines, the command refuses: show its message and stop.
5. **Report.** Relay everything the command printed, the removals and the warnings included, in the person's words rather than pasted.
   - When it warned that Claude Code keeps session files only briefly, say that a call is measured only if it is read before the files are removed, and give the setting it named.
6. **Prove.** Run `aidd telemetry report --days 1`, and state what it shows.
   - No calls yet is a normal answer for a project that has just opted in: say so, and that the next Claude Code session in this project will be counted.
7. **Tell the rest.** Say that the plugin is what asks about the task and that it needs `node`, and that a task can always be declared by hand with `aidd telemetry task <name> [--ticket <ref>]` or `aidd telemetry task --none`, and that `aidd telemetry status` shows whether a clone is measured and its task.

## Test

| Case | Pass |
| --- | --- |
| The person says no | No `aidd telemetry on` was run and the project is unchanged |
| The person says yes, with no identity set | They were asked how to appear, offered the git name when there is one, and exactly one of `aidd telemetry on --yes --as <id>`, with the text they chose, or `aidd telemetry on --yes --anonymous` ran |
| The person says yes, with an identity set | They were asked nothing about a name, were told the one they are measured under, and `aidd telemetry on --yes` ran |
| The person says yes | `aidd telemetry on` ran once, the person was told that measurement starts now and that earlier history is not counted, and the command printed that the clone's consent is set; if it said it removed or deleted a block in `.aidd/config.json`, the person was told that file may need committing |
| `aidd` has no `telemetry` | The skill said so and ran nothing else |
| Run outside a git repository | The refusal was shown and nothing was written |
