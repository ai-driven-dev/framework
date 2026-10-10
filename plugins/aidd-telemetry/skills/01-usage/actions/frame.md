# Frame

Turn the question into one period and one axis, and name the exact command.

## Input

The person's question, in their words.

## Output

The command to run, and the period and axis it stands for, said back to the person in one line.

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
   | each task | `--axis task` |
   | each ticket | `--axis ticket` |
   | each session | `--axis session` |
   | each repository | `--axis repository` |
   | each person | `--axis person` |

3. **One axis.** When the question crosses two axes, such as tasks per day, run one report per axis and answer each. Say that the report has no cross of two, and do not combine them.
   - A question about a currency cost, a skill, a step, a prompt or a file has no axis: say what the report can split by, and stop.
4. **Name.** Write the command as `aidd telemetry report --json` plus the flags chosen, e.g. `aidd telemetry report --days 7 --axis task --json`.

## Test

| Case | Pass |
| --- | --- |
| "What did last week cost in tokens?" | `aidd telemetry report --days 7 --axis total --json`, with the window stated |
| "Which tasks used the most?" | `--axis task`, no period, stated as every recorded day |
| "How much money was that?" | No command; the answer says the report holds token counts only |
| "Tasks per day" | Two commands, `--axis task` and `--axis day`, and no figure combined from both |
