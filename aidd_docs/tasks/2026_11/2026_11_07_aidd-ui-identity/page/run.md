# Run: the comparison page

Evidence for the comparison page spec: one browser pass in three engines, the suites, and the mutation of each guard.

## Suites

- Wrapped scripts suite: 1673 pass, 0 fail, 0 skipped.
- `pnpm exec lefthook run pre-commit`: green.

## Browser

`@playwright/cli@0.1.17` over `file://`, on a generated project: a brand page of three variants (ledger, signal, atlas) and a component page with states and two themes. Console: no error in any engine.

| Criterion | Chrome | Firefox | WebKit | Evidence |
| --- | --- | --- | --- | --- |
| 12 Switch, pair, discard, undo | pass | pass | pass | frame is 1280 by 800 scaled; box height equals 800 times the scale |
| 12 Theme and state | pass | pass | pass | a hidden frame takes both, then shows scaled |
| 13 Progress | pass | pass | pass | `2/3`, `3/3`, `2/3 decided` |
| 14 Copy | pass | pass | pass | label `Copied`; same text in all three |
| 15 Copy refused | pass | pass | pass | JSON opens, whole text selected |
| 16 Pairing | pass | pass | pass | shift-click pairs; a frame click selects, pair kept |
| 17 Keys | pass | pass | pass | K, R, D, arrows, C; ignored with a modifier or in a field |
| 18 Tab and Enter | pass | pass | pass | WebKit with Alt+Tab |
| 19 Button size | pass | pass | pass | smallest 28px, 14 buttons |
| 20 Contrast | pass | pass | pass | every chrome text at least 4.5 in both schemes, also 2 up, Spec and the open sheet |
| 21 Frame untouched by the chrome theme | pass | pass | pass | frame pixels identical light and dark, window corners left out |
| 22 Restore after reload | pass | pass | pass | feedback, selection, pair, view and layout restored |
| 23 Changed variant file | pass | pass | pass | `2/3 decided`, then `0/3` after `compare` reran |
| 24 Storage refused | pass | pass | pass | page works; a reload restores nothing |
| 25b Screenshots, 1280 and 375, light and dark | pass | pass | pass | no horizontal scroll at 375, paired included; shots in `page-shots-v5/` |
| W4 Screen default, Spec switch | pass | pass | pass | Screen and `1 up` pressed at load; Spec shows the document, Screen returns |
| W5 Layout and pair | pass | pass | pass | `2 up` pairs the next variant; shift-click re-pairs; view, layout and pair survive a reload |
| W7 Shortcut sheet | pass | pass | pass | `?` opens and toggles, Escape closes; K still decides; typing `?` in a field opens nothing |
| W10 Real viewport and zoom | pass | pass | pass | scale is box width over 1280 (since W12, the fit of width and height); the zoom shows in each title bar; Mobile is 390 by 844; a resize recomputes; a frame shown later is scaled; Desktop or Mobile survives a reload. Figures: W12 and W13 below |
| W12 Fit to the canvas | pass | pass | pass | no canvas scroll and every frame bottom inside the canvas in all eight cases of the table below; frames centred, top gap equal to bottom gap and left to right within 2px (focus two up and one up Desktop at 1280, and at 2560); box height equals 800 times the scale |
| W13 Arrangement | pass | pass | pass | Desktop two up stacks at 1280 and 1440, Mobile stays side by side; the table below holds the measured zoom |
| W14 Focus | pass | pass | pass | button (with its `\` key cap and a title) and `\` toggle, `aria-pressed` follows, canvas 752 to 1280 wide at a 1280 window, survives a reload, K still decides in focus, `\` typed in the comment types it and toggles nothing, Shift with `\` ignored |
| W9 Done hint | pass | pass | pass | hidden until `3/3 decided`, then `progress complete` |

Zoom per case, Chrome, Firefox and WebKit identical (window 1280 by 800 and 1440 by 900, focus off):

| Window | Layout | Desktop | Mobile |
| --- | --- | --- | --- |
| 1280 | 1 up | 55% | 73% |
| 1280 | 2 up | 35%, stacked | 73%, side by side |
| 1440 | 1 up | 68% | 85% |
| 1440 | 2 up | 41%, stacked | 85%, side by side |

With focus on at 1280, two up Desktop picks side by side at 47%. At 800 wide the page is one column: two up Desktop stacks at 60%, capped by width.

Focus below 900px is not special-cased: the navigator and inspector hide the same way, which took no code.

Firefox restored a stale comment across reload. The comment field now sets `autocomplete="off"`.

Criterion 25a is a node test, in the mutation table below.

Limits:

- Chrome stands in for Chromium, absent from this runner.
- Playwright's own Firefox and WebKit builds, headless, not the installed apps.
- WebKit on macOS tabs to buttons only with Alt+Tab.
- Memory across a full browser restart is untested.
- The component fixture holds plain state chips, so its frames show little.
- One up Desktop at 1280 is limited by width (55%), so a band stays empty below the frame; a larger scale would overflow sideways.
- Fit is capped at 100% at every width: on a 2560 by 1300 window Mobile one up and two up show 100%, Desktop one up 100%, Desktop two up 77%.

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
| Toolbar | `class="toolbar"` renamed | toolbar test |
| Selects out of the top bar | a `<select>` put in the header | selects test |
| Screen default | default view forced to Spec | default view test |
| Window title | verdict pill text `Undecided` changed | window title test |
| Sheet wiring | `aria-controls` removed | help sheet test |
| Verdict hint | `title` removed from the verdict buttons | verdict key test |
| Legend | one entry removed | legend test |
| Done hint | `#done` no longer hidden | done hint test |
| Screen size default | Desktop button written unpressed | screen size test |
| Screen size toolbar | the Mobile button removed | toolbar and screen size tests |
| Zoom label | zoom span removed from the title bar | zoom test |
| Real viewport | a `clamp()` height put back on the frame | zoom test |
| Inspector width | 18rem written 23rem | inspector width test |
| Mobile viewport | 390 written 400 | screen size test |
| Arrangement choice | `stacked` forced false | fit test |
| Arrangement written | `data-arrange` always `side` | fit test |
| Fit by width and height | `side` scale offset by 1 | fit test |
| Fit follows the stage | observer put on the canvas | fit test |
| Focus hides both panes | aside left visible | focus test |
| Focus remembered | restore line removed | focus test |
| Focus key | `\` key handler matching `|` | focus test |
| Focus button | written pressed at load | focus test |
| Shortcut sheet | `\` entry removed | help sheet test |
| Fit capped at 100% | the `Math.min(1, ...)` removed | fit test |
| Frames centred | `align-items: center` removed | fit test |
| Focus key cap | the `<kbd>` removed from the button | focus test |
| Focus title | the key left out of `title` | focus test |
| Neutral chrome | `--muted` set to a tinted hex | greyscale test |

Clicks, keys, copy and memory are browser script, checked in the browser pass, not in node.
