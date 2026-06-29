# 03 - Act

Carry out what the user picked: run the suggested skill, explain it, teach the whole flow, switch to a different step, or stop. Loop back to reading the project after each one.

## Input

- The user's choice from `02-orient`.
- The resolved skill, or a gap when no installed skill fits.
- The working notes from `01-read-project`, held in context.

## Output

One outcome, always ending with a clear next prompt or a clean stop.

| Choice          | What happens                                                                | Loop back to 01? |
| --------------- | --------------------------------------------------------------------------- | ---------------- |
| Run it           | Invoke the resolved skill in this session, then ask the user how it went    | yes              |
| Explain the step | Describe the step and its skill in two or three plain lines, then re-offer the choices | no, re-offer |
| Explain project  | Summarize the project from its memory bank, read-only, then re-offer the choices | no, re-offer |
| Show flow + skills | Walk the AIDD flow in plain language and list the installed skills grouped by step, then re-offer the choices | no, re-offer |
| Different step   | Let the user pick another step, resolve it, and re-offer the choices         | no, back to 02   |
| Hand off         | Give the exact command to run in a fresh session, then wait for the user to come back | yes      |
| Stop             | A one-line goodbye, end the loop                                             | no, terminate    |

## Process

1. **Run it.** Invoke the resolved skill directly. When it returns, ask the user how it went and wait. Then read the project again (`01`), since it has changed.
2. **Explain the step.** Pull the resolved skill's purpose from its description and say, in two or three plain lines, what the step does and what it produces. Do not invoke. Re-offer the choices.
3. **Explain the project.** Summarize the project from its memory bank: what it is, the stack, the shape, the key decisions, in a few plain lines. Read-only, never invoke. Re-offer the choices. Available only when the memory is filled.
4. **Show flow and skills.** Walk the AIDD flow from `@../references/journey.md` in plain language, then list the installed skills grouped by the step each fits (and the ones that fit no step), discovered from `01`, never hardcoded. Then re-offer the choices. This is the teaching path.
5. **Different step.** Hand back to `02-orient` to show the steps and let the user pick another, then resolve it.
6. **Hand off.** Give the user the exact command to run in a new session, ask them to come back when done, and wait. Then read the project again.
7. **Stop.** Say one closing line and end. Do not loop.
8. **A gap.** If the chosen step has no installed skill, Run and Hand off are unavailable. Say the step needs a plugin that is not installed, by function only, then offer to explain it, a different step, or stop.
9. **Resolve, never invent.** Only ever run or name a skill that `01` found installed.

## Test

- Run invokes only an installed skill, then loops back to `01`.
- Explain the step produces a short plain description and re-offers the choices without invoking anything.
- Explain the project summarizes from the memory bank, writes nothing, and re-offers the choices.
- Show flow and skills walks the flow and lists the installed skills grouped by step, then re-offers the choices.
- Hand off produces an exact command and waits for the user to return.
- Stop ends the loop cleanly.
- A gap step never produces a skill invocation. It offers to explain it, a different step, or stop only.
