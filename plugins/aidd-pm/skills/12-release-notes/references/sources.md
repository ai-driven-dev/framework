# Sources

## Release range

| Given | Range |
| --- | --- |
| two refs | the first ref to the second |
| one tag or version | the tag before it to that tag |
| a release name only | the tag matching it, else ask for the refs |
| nothing | the latest tag to `HEAD`, confirmed with the user before use |
| no tag exists | ask for the refs; never assume a start |

## Where each fact comes from

| Fact | Source, in order |
| --- | --- |
| merged pull requests | the configured VCS tool for the range, else merge commits in `git log <from>..<to>` |
| commits and changed paths | `git log` and `git diff --stat` on the range |
| ticket ids | the given list, then pull request titles and bodies, branch names, and commit messages, per the project's ticketing convention |
| ticket records | the configured ticketing tool, else tickets pasted by the user |
| epic, PRD, product brief, roadmap | the tracker parent of each ticket, then matching files under `aidd_docs/` |

## Configured tools

| Source, in order | Holds |
| --- | --- |
| project memory | the configured ticketing and VCS tools |
| repo configuration | fallback |
| environment | fallback |
| the remote URL | the VCS tool only |

When no ticketing tool resolves, ask the user to paste the ticket list.

## Ticket status

| Observed | Recorded as |
| --- | --- |
| ticket done and its change merged in the range | shipped |
| change merged in the range, ticket still open | partially shipped |
| ticket listed, no change merged in the range | not in this release |
| change merged in the range, no ticket found | untracked change |
| change merged behind a feature flag the sources name | shipped, disabled by default |
