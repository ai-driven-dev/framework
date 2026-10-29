# Governance

## Roles

Each role keeps the rights of the roles below it.

| Role | Who | Adds |
| --- | --- | --- |
| **Public** | Anyone with a GitHub account | Open issues, comment, react, open a pull request on a validated issue |
| **Core Team** | An active member of the [AIDD programme](https://www.ai-driven-dev.fr/) | A counted vote on the roadmap |
| **Certified Member** | Passed the [AIDD certification](https://www.ai-driven-dev.fr/) | Validate contribution issues |
| **Maintainer** | A certified member who gives AIDD trainings, or AIDD staff | Approve and merge pull requests, block a change, promote people |

## Code decisions

Only a Maintainer merges.

| Case | Rule |
| --- | --- |
| Default | One Maintainer approval and passing checks |
| A change falls short | Any Maintainer blocks it by requesting changes, until it is resolved |
| Across plugins, a contract, the license or this document | Two Maintainer approvals |

## The roadmap

```mermaid
flowchart LR
  idea(["Idea or issue"]) --> signal["Reactions<br/><i>a signal</i>"] --> vote["Formal vote<br/><i>7 days or more</i>"] --> board(["Roadmap board<br/><i>sets the order</i>"])
  classDef cOpen fill:#0969da,stroke:#0969da,color:#fff
  classDef cVote fill:#6f42c1,stroke:#6f42c1,color:#fff
  classDef cDone fill:#1a7f37,stroke:#1a7f37,color:#fff
  class idea,signal cOpen
  class vote cVote
  class board cDone
```

| Who | Counts as |
| --- | --- |
| Anyone | A reaction: a signal that opens a formal vote |
| Core Team, Certified Members, Maintainers | One equal vote each |
| Maintainer | Breaks ties |

- The board: [AIDD Roadmap](https://github.com/orgs/ai-driven-dev/projects/8).
- A milestone is a theme due on a Thursday. Items without one are the backlog, ordered by priority.
- The vote orders the roadmap. It does not decide whether a validated issue can become a pull request.

## Influence the roadmap

| Where | What |
| --- | --- |
| [Framework Evolution](https://discord.gg/DyzRuZ7SF?event=1514565536695193710) | The weekly Discord event where the roadmap is decided |
| [Discussions](https://github.com/ai-driven-dev/framework/discussions) | Open an idea, and 👍 what you want |
| [Discord channel](https://discord.com/channels/1173363373115723796/1512081578858119238) | Talk with the community |
| [Changelog](CHANGELOG.md) | What shipped |

## Conduct

[Code of Conduct](CODE_OF_CONDUCT.md). Changes to this document need two Maintainer approvals.
