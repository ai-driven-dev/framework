# 02 - Orient

Tell the user, in plain language, where their project sits in the AIDD flow and the single most useful next step. Teach as you go. Then let them choose.

## Input

The working notes from `01-read-project`, held in context, not printed.

## Output

A short, plain briefing the user can act on. No internal variable names, no raw labels, no snapshot. It has three parts:

1. **One line on the project**: its purpose and stack drawn from the memory bank when it is filled, otherwise from the files, or that it is a fresh repo. The memory is the project's own context and leads here.
2. **Where it sits**: one or two sentences placing the project in the AIDD flow, explaining any term the first time it appears.
3. **The next step plus choices**: the suggested step in plain language with a one-line why, then a short numbered list of what the user can do, and a prompt to reply with a number. The list stays small and stable: run the suggested step, run it in a fresh session instead, explain that step first, explain this project from its memory (only when the memory is filled), see the whole AIDD flow and the installed skills, go to a different step, stop.

## Process

1. **Read the notes from 01.** Print nothing from them directly.
2. **Place the project.** Using `@../references/journey.md`, find the earliest **unmet** stage, where a stage counts as met if a disk fact satisfies it **or** the session ledger marks it done or skipped this session. Excluding the ledger's done and skipped stages is what stops a just-run or just-declined step being suggested again. That earliest remaining stage is the suggestion, a hint never a verdict. When it is a foundation stage — architect a stack on an empty repo, or set up the memory bank on a content repo with weak memory — it is the loud, pre-selected default; otherwise it is an ordinary suggestion.
3. **Resolve the suggestion** to an installed skill (`@../references/journey.md`, Resolving). If no installed skill fits, the step is a gap: name the missing capability by function, never a skill or plugin id.
4. **Write the briefing** in plain language: the one-line project, where it sits, and the suggested step with a short why. When the suggested step is a foundation default, present it as the pre-selected default — the first choice, tagged `(recommended)` — and say plainly it can be skipped. Explain any AIDD term the first time it appears.
5. **Offer choices.** A short, stable numbered list with plain labels: run the suggested step, run it in a fresh session instead, explain that step first, explain this project from its memory (only when the memory is filled), see the whole AIDD flow and the installed skills, go to a different step, stop.
6. **Wait for a reply.** Free text re-renders the same choices with a one-line reminder to reply with a number. Never auto-advance.
7. **On a different step**, show the flow steps from `@../references/journey.md` in plain language, let the user pick one, and resolve it to a skill or a gap.
8. **Hand the choice to `03-act`**, with the resolved skill (or gap) and what the user picked. Acting on the choice belongs to `03-act`, not here.

## Test

- The output is plain language. No internal note names, no raw stage labels, no snapshot reaches the user.
- It names where the project sits and exactly one suggested next step, resolved to an installed skill or a named gap.
- It offers explicit numbered choices and waits for the user.
- On an empty repo the loud pre-selected default is architect-a-stack; on a content repo with weak memory it is set-up-the-memory-bank; both are stated as skippable.
- A suggested step never names a skill or plugin that is not installed.
