# Recipe contract

## Writing

- Keep prose that helps the reader perform, understand, or verify the technique.
- State where and when a technique applies.

## Steps

- One step covers one technique, named for its action.
- Headings express nesting without skipping a level; number steps continuously from 1 across categories.
- Give each step a concrete, usable command, configuration, output, table, or operational image; code examples must be syntactically valid.
- Write a command that runs a JavaScript package without installing it as `{runner} tool`, where `{runner}` is the package runner the project's lockfile points to (`package-lock.json` is `npx`, `pnpm-lock.yaml` is `pnpm dlx`, `bun.lock` or `bun.lockb` is `bunx`, `yarn.lock` is `yarn dlx`), or the user's own when there is no lockfile; never a literal one.
- Keep `{runner}` for that case only: a binary the project installs runs through its own exec form or a plain documentation link, and a runner of another ecosystem such as `uvx` stays literal.
- Local links and table-of-contents anchors must resolve; remove unfinished placeholders other than `{runner}`.

## Evidence

- Verify commands, configuration, and behavior against current official sources; link them where they are used.
- Qualify claims as measurements, maintainer claims, or inferences when their strength is not obvious; state relevant conditions and limits.
- Support promised savings with measurements and their workload; never present an unverified claim as fact.
