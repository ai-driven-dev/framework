# Reading sources

## Read in this order

1. Manifests, workspace file, lockfile: stack, packages by name, published name.
2. Root README, then any `docs/`: what it does, for whom, domain words.
3. Top-level directories: the shape, who owns what.
4. Entry points the manifests declare: where execution starts.
5. Every file under the VCS platform's own directory: how it ships, what runs on a schedule.
6. What runs before a commit or push, and the task commands: the gate commands.
7. Commit rules, contribution guide, AI instructions and rules outside the memory and its synced block: commit types, conventions already covered.
8. Test configuration, one test file: layers, tools, conventions.
9. The code, area by area: what the docs above got wrong.

## Reading rules

- Take a command or convention from the file that defines it; check prose naming one against that file.
- Read the root README whole, and the other docs a section needs.
- Read the code last: it corrects the others and is never summarised.
- In a monorepo, read every workspace, never the root manifest alone.
- Read a directory name repeated across areas once.
- Read nothing under a dependency directory, a build output, or a path the VCS ignores.
- Keep a fact only if the reader rules of [memory-rules](memory-rules.md) keep it.

## Keeping facts

- Skip a fact the bank already holds.
- Keep every fact the sources state, one line each: each gate, decision, gotcha, rule and release step.
- Take the brief's `Users`, `Main journey` and `Business rules` only from the repository, else ask, never invent.
- A setup collects them; a refresh never adds them.
