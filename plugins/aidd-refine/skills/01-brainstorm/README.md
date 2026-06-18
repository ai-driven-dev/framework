← [aidd-framework](../../../../README.md) / [aidd-refine](../../README.md)

# 01 - Brainstorm

Turns a vague idea into a precise one through a deep, natural conversation, at whatever level the user is thinking, functional or technical. It asks pointed questions, follows the threads each answer opens, and challenges assumptions until the idea is clear enough to act on. It digs, it does not tick boxes.

## When to use

- The user surfaces a half-formed idea, a fuzzy feature, a technical question, or an under-specified request.
- An idea would otherwise force the next step (plan, code, test) to rest on assumptions.
- The user asks to brainstorm, clarify, or refine before committing.

## When not to use

- To scan a written artifact for gaps. Use `aidd-refine:04-shadow-areas`.
- To critique finished work. Use `aidd-refine:02-challenge`.
- The idea is already concrete enough to plan or code.

## The loop

`capture` restates the idea and reads its altitude. Then `probe → integrate` repeats: each round asks pointed questions on the live thread, follows the forks the answers open, challenges assumptions, and folds the answers back in. It keeps going until no real ambiguity remains or the user is satisfied. There is no fixed round count, the idea is done when it is clear, not on a timer. `finalize` consolidates the refined idea, flags every open assumption and risk, and offers to persist it to a dated file under `aidd_docs/brainstorm/`, a ticket, or the session only.

## What makes it dig

- **Follows threads, not topics.** It pulls on the fork an answer opens (filename versus full-text search, for instance), where the depth is, instead of cycling a fixed list.
- **Works at your altitude.** A technical question gets technical probing, a fuzzy feature gets product probing, never one level finer than you opened.
- **Leans when the facts point.** When the answers favor one option it says so with the tradeoff, and keeps the implementation as a flagged assumption for planning.
- **Flags, never fakes.** Whatever stays open is reported as an assumption or risk, never dressed up as settled.

## Details

See [`SKILL.md`](SKILL.md) for the contract, [`actions/`](actions/) for the four actions, [`references/probing.md`](references/probing.md) for how to read altitude, follow threads, the tactics, and when to stop, and [`assets/question-angles.md`](assets/question-angles.md) for the topical prompt banks.
