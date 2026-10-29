# Contributing

One path, open to everyone. Who may do what is in [Governance](GOVERNANCE.md#roles).

<!--contribute:start-->

<p align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/assets/diagrams/contribute-dark.svg"><img src="docs/assets/diagrams/contribute-light.svg" alt="How to contribute: Issue, Validated, Branch, Change, Pull request, Review, Merged." width="520"></picture></p>

<!--contribute:end-->

## 1. Share it

- Just a question? Ask in [Discussions](https://github.com/ai-driven-dev/framework/discussions).
- Otherwise open an issue: a [bug report](https://github.com/ai-driven-dev/framework/issues/new?template=bug_report.yml), a [quick contribution](https://github.com/ai-driven-dev/framework/issues/new?template=quick_contribution.yml) (a problem and its solution) or a [detailed contribution](https://github.com/ai-driven-dev/framework/issues/new?template=detailed_contribution.yml) (a scope and acceptance criteria).
- A Certified Member or a Maintainer validates it by moving it to `Todo`. Then anyone can pick it up, not only the person who opened it.

## 2. Set up

You need [Node](https://nodejs.org) 22.18+ or 24.11+ (26 and later also work) and [pnpm](https://pnpm.io). The skills that talk to GitHub also use `gh` and `jq`.

Fork the repository, or branch from it if you have write access. Then:

```sh
make setup
```

It installs the dependencies and the git hooks, registers the marketplace, and installs the plugins into Claude Code and Codex. Run `make` to list every target, `make doctor` to check your environment and `make check` to run the pre-commit checks.

## 3. Make your change

1. **No slop.** Read every line before you propose it.
2. **Spend tokens like they cost something.**
3. **Write in Claude Code syntax.** Skills, agents and rules use it; the [CLI](cli/README.md) translates them for the other tools at release.
4. **Follow the skill structure.** See the [architecture](docs/ARCHITECTURE.md) and generate with `/aidd-context:04-skill-generate`.
5. **Evolve the memory** in [`aidd_docs/memory/`](aidd_docs/memory/).
6. **Test locally.** Run `make reload`, restart your session, and test in Claude Code and in one other tool, for example Codex.
7. **Commit as `<type>(<scope>): description`**, one scope per commit. See the [convention](aidd_docs/memory/vcs.md#commits).

## 4. Open a pull request

- Branch off `next` and target `next`. The [routing table](aidd_docs/memory/vcs.md#branches) lists the exceptions.
- Fill in the [pull request template](.github/PULL_REQUEST_TEMPLATE.md): what changed and how you solved it.
- A Maintainer review gates every merge: [how decisions are made](GOVERNANCE.md#code-decisions).

More: [Architecture](docs/ARCHITECTURE.md) · [Concepts](docs/CONCEPTS.md) · [Maintainers guide](docs/MAINTAINERS.md) · [Back to the README](README.md)
