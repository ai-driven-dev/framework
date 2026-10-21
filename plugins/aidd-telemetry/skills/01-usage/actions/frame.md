# Frame

Turn the question into one period, one axis and the filters it fixes, and name the exact command.

## Input

The person's question, in their words.

## Output

The command to run, and the period, axis and filters it stands for, said back to the person in one line.

## Process

1. **Period.** Pick the window the question names, in UTC days.
   - A number of recent days, today included: `--days <n>`. "Today" is `--days 1`, "this week" is `--days 7`, and the window is stated back.
   - Two dates: `--from <date>` and `--to <date>`, as `YYYY-MM-DD`. They cannot be combined with `--days`.
   - No period named: give none, which reads every recorded day, and say so.
2. **Axis.** Pick the one axis the question splits by.

   | The question asks for | Axis |
   | --- | --- |
   | one total | `--axis total` |
   | each day | `--axis day` |
   | each model | `--axis model` |
   | the main session, its sub-agents, the advisor | `--axis agent` |
   | each task | `--axis task` |
   | each ticket | `--axis ticket` |
   | each session | `--axis session` |
   | each repository | `--axis repository` |
   | each person | `--axis person` |
   | Claude Code and Codex apart | `--axis tool` |

3. **Filters.** A value the question fixes on another axis becomes a filter, so "what did task `auth` cost per day" is `--task auth --axis day`. Filters combine with AND, one per axis.

   | The question fixes | Filter |
   | --- | --- |
   | one task, ticket, person or model | `--task <name>`, `--ticket <ref>`, `--person <id>`, `--model <id>`, as the report's `key` prints it |
   | the main session, its sub-agents or the advisor | `--agent main`, `--agent subagent`, `--agent advisor` |
   | one tool, Claude Code or Codex | `--tool claude-code`, `--tool codex` |
   | one session or repository | `--session <id>`, `--repository <id>`: the full id or its start, as the text report shows it |
   | the repository the person is in | `--repository .` |
   | work with no task | `--unattributed`, or `--unattributed no-binding` / `--unattributed declared-none` for one reason |
   | calls with no model, no identity, or a task with no ticket | `--absent model`, `--absent person`, `--absent ticket` |

   - One day is a period, `--from D --to D`, not a filter.
   - `--unattributed` cannot be combined with `--task`, `--ticket` or `--absent ticket`; a value and `--absent` of the same axis cannot be combined either.
4. **One open axis.** When the question splits by two axes with neither fixed, such as tasks per day, run one report per axis and answer each. Say that the report has no cross of two, and do not combine them.
   - A question about a currency cost, a skill, a step, a prompt or a file has no axis: say what the report can split by, and stop.
   - Reasoning or thinking tokens have no figure of their own: they are counted in `output`. Say so.
5. **Name.** Write the command as `aidd telemetry report --json` plus the flags chosen, e.g. `aidd telemetry report --days 7 --axis task --json`.

## Test

| Case | Pass |
| --- | --- |
| "What did last week cost in tokens?" | `aidd telemetry report --days 7 --axis total --json`, with the window stated |
| "Which tasks used the most?" | `--axis task`, no period, stated as every recorded day |
| "How much money was that?" | No command; the answer says the report holds token counts only |
| "How many thinking tokens this week?" | No figure apart; the answer says reasoning is counted in `output` |
| "Tasks per day", no task named | Two commands, `--axis task` and `--axis day`, and no figure combined from both |
| "What did task auth cost per day?" | `aidd telemetry report --task auth --axis day --json`, no period, stated as every recorded day |
| "Which models did ticket PROJ-7 use this week?" | `aidd telemetry report --days 7 --ticket PROJ-7 --axis model --json` |
| "What did this repository cost per task?" | `aidd telemetry report --repository . --axis task --json` |
| "How much work had no task, per session?" | `aidd telemetry report --unattributed --axis session --json` |
