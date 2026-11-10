# Run: the comparison page

Evidence for the comparison page spec: one browser pass in three engines, the suites, and the mutation of each guard.

## Suites

- Wrapped scripts suite: 1659 pass, 0 fail, 0 skipped.
- `pnpm exec lefthook run pre-commit`: green.

## Browser

`@playwright/cli@0.1.17` over `file://`, on a generated project: a brand page of three variants (a filled brand template with a glossary table), and a component page with states and two themes. Console: no error in any engine.

| Criterion | Chrome | Firefox | WebKit | Evidence |
| --- | --- | --- | --- | --- |
| 12 Switch, pair, discard, undo | pass | pass | pass | frame height 384 once shown |
| 12 Theme and state | pass | pass | pass | a hidden frame takes both, then shows at 384 |
| 13 Progress | pass | pass | pass | `2/3`, `3/3`, `2/3 decided` |
| 14 Copy | pass | pass | pass | label `Copied`; same text in all three |
| 15 Copy refused | pass | pass | pass | JSON opens, whole text selected |
| 16 Pairing | pass | pass | pass | shift-click pairs; a frame click selects, pair kept |
| 17 Keys | pass | pass | pass | K, R, D, arrows, C; ignored with a modifier or in a field |
| 18 Tab and Enter | pass | pass | pass | WebKit with Alt+Tab |
| 19 Button size | pass | pass | pass | smallest 28px |
| 20 Contrast | pass | pass | pass | at least 5.25 light, 5.17 dark; verdict tints at least 6.15 |
| 21 Frame untouched by the chrome theme | pass | pass | pass | frame pixels identical light and dark, bar the 10px rounded corners the card clips |
| 22 Restore after reload | pass | pass | pass | same feedback text in all three |
| 23 Changed variant file | pass | pass | pass | `2/3 decided`, then `0/3` after `compare` reran |
| 24 Storage refused | pass | pass | pass | page works; a reload restores nothing |
| 25b Screenshots, 1280 and 375, light and dark | pass | pass | pass | no horizontal scroll at 375, paired included; shots in `page-shots-v2/` |

Firefox restored a stale comment across reload. The comment field now sets `autocomplete="off"`.

Criterion 25a is a node test, in the mutation table below.

Limits:

- Chrome stands in for Chromium, absent from this runner.
- Playwright's own Firefox and WebKit builds, headless, not the installed apps.
- WebKit on macOS tabs to buttons only with Alt+Tab.
- Memory across a full browser restart is untested.

## Mutations

Each guard broken once, its own test red, then restored.

| Guard | Mutation | Red test |
| --- | --- | --- |
| Variant order | pick list reversed | order test |
| Feedback verdict | verdict emitted as `""` | feedback and copy tests |
| Progress | written `1/N` | regions and progress |
| One panel per variant | panels reversed | one of each per variant |
| First shown | hidden dropped from panels | first shown |
| Three verdicts | two verdict buttons | three verdict buttons |
| JSON disclosure | feedback moved out of the disclosure | JSON disclosure |
| Dark chrome | media query removed | dark scheme |
| Memory key | key left out of the script | key test |
| Stable fingerprint | time hashed | stable fingerprint |
| Fingerprint follows content | file texts left out | fingerprint follows content |
| Help names the verdict | rating line restored | help names verdict |
| Markdown document | text files written back into `<pre>` | markdown document test |
| Stale comment | `autocomplete="off"` removed | comment test |

Clicks, keys, copy and memory are browser script, checked in the browser pass, not in node.
