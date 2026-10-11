# Audiences

## Sections kept

| Section | Internal | Customer |
| --- | --- | --- |
| Summary | yes | yes |
| Scope | every status, with refs | shipped items only, no refs |
| What you can do now | yes | yes |
| Where it fits | epic and roadmap position | the product area only |
| Impacted areas | yes | omitted |
| Known limitations | all of them | only those a user can hit |
| Demo | yes | optional, when the user asks for it |
| Open questions | yes | omitted; a TBD blocks sharing |

## Wording

| Audience | Rule |
| --- | --- |
| both | one benefit per line, starting with what the user can now do |
| both | plain words; no internal code name unless the product uses it |
| internal | code areas named by the capability they serve, never by file path |
| customer | no ticket id, pull request, branch, team name, or internal tool |
| customer | no promise of a future date or feature |

## Publication risks

Flag each one for the user; never drop or keep it silently.

- a security fix whose detail could expose users before they update
- a feature shipped disabled or behind a flag
- a customer, partner, or person named in a ticket
- an item marked partially shipped or not in this release
- a limitation that contradicts a public commitment found in the sources
