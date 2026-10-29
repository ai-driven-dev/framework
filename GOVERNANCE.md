# Governance

How decisions get made in the AI-Driven Dev Framework.

Four roles form a **ladder**, each rung keeps every right of the rungs below and adds its own.

## 👥 Roles

| Tier | How you get there | Adds (on top of the rung below) | Team |
| ---- | ----------------- | ------------------------------- | ---- |
| **Public** | Free, any GitHub account | Open issues, comment, react / upvote ideas (signal only), **open a pull request** once its issue is validated | - |
| **Core Team** | Active [AIDD programme](https://www.ai-driven-dev.fr/) member (training, community, coaching) | A **counted roadmap vote** + voice on direction | [`core-team`](https://github.com/orgs/ai-driven-dev/teams/core-team) |
| **Certified Members** | Pass the [AIDD certification](https://www.ai-driven-dev.fr/) | **Validate contribution issues** (triage: move `Ideation` → `Todo` on the [Roadmap board](https://github.com/orgs/ai-driven-dev/projects/8)) | [`certified-members`](https://github.com/orgs/ai-driven-dev/teams/certified-members) |
| **Maintainer** | Certified member promoted to give AIDD Trainings (**Trusted Partner**), or **AIDD Staff** | **Approve & merge** PRs, **quality veto**, appoint/promote, guard the standard | [`trusted-partners`](https://github.com/orgs/ai-driven-dev/teams/trusted-partners) |

## 📊 Roadmap voting

- **Public** reacts (👍 / upvote). This is a **signal**, not a counted vote; it
  promotes an item to a formal vote.
- **Core Team, Certified, Maintainer** each cast **one equal vote**. The vote is a
  benefit of AIDD membership (the programme is a paid training / community /
  coaching offering), that is what turns a signal into a counted vote.
- **Maintainer** holds the tiebreak and a **quality veto** as the top rung.
- A poll runs **≥ 7 days**. Accepted items land on the
  [AIDD Roadmap board](https://github.com/orgs/ai-driven-dev/projects/8).
- This vote decides **roadmap priority**, not whether a contribution issue can
  move to a PR, that validation is immediate, see [`CONTRIBUTING.md`](CONTRIBUTING.md).

## How to influence the roadmap

The live roadmap is the [AIDD Roadmap board](https://github.com/orgs/ai-driven-dev/projects/8). A milestone is a theme due on a Thursday, and every item without a milestone is the backlog, ordered by priority. To weigh in:

- Join the weekly Discord event [Framework Evolution 🇫🇷🥖](https://discord.gg/DyzRuZ7SF?event=1514565536695193710), where the roadmap is decided.
- Open an issue or an idea in [GitHub Discussions](https://github.com/ai-driven-dev/framework/discussions), and 👍 what you want.
- Talk in the [framework channel on Discord](https://discord.com/channels/1173363373115723796/1512081578858119238).
- To fund work, see [`.github/FUNDING.yml`](./.github/FUNDING.yml).

Shipped changes are in [`CHANGELOG.md`](./CHANGELOG.md).

## ✅ Code decisions

- Merge authority is **Maintainer only**.
- **Lazy consensus** (default): a Maintainer may merge if no other Maintainer objects within 72h, there is ≥1 Maintainer approval, and CI passes.
- **Quality veto**: any Maintainer can block with a `request-changes` review until resolved.
- **Explicit consensus** : for cross-plugin changes, contract changes, or licensing/governance changes: ≥2 Maintainer approve.

## 📜 Code of Conduct & amendments

- All interactions follow the [Code of Conduct](./CODE_OF_CONDUCT.md).
- Changes to this document follow the explicit-consensus rule above.
