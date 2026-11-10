# Run: aidd-ui 4c, screens, contrast, touch targets

Evidence for slice 4c: one pilot pass, the checks on pilot output, the suites, and the mutation of each guard.

## Suites

- Wrapped scripts suite: 1737 pass, 0 fail, 0 skipped.
- `pnpm exec lefthook run pre-commit --all-files`: green, 20 jobs.

## Pilot

Blank once, Kairos twice. Warnings follow the model's choices and do not count.

```txt
blank errors none warnings V6 wireframes all screens all code untouched steps ok
kairos errors none warnings C3,C4,R18,V6 wireframes all screens missing 10 code untouched steps broken 1
kairos errors none warnings C3,C4,V6 wireframes all screens all code untouched steps ok
```

Blank: six wireframes, six screens, each naming its wireframe.

Kairos, first run: `05-screens` stopped at prepare and wrote nothing. Every wireframe expects a component the chain did not write. Its reply, for the four it would have dressed first:

| Wireframe | Missing component |
| --- | --- |
| `practice-active` | `live-session-exit-guard` |
| `practice-config` | `card` |
| `practice-list` | `practice-card` |
| `duel-waiting-room` | `player-panel` |

The other six miss two to eight each. This is the stop the slice asks for, on real data: named, none created.

The pilot capped `04-components` at eight components and `05-screens` at four screens. The person chose one full rerun, with both caps removed.

Kairos, second run: nine wireframes, nine screens, each naming its wireframe. Each screen was compared, then one variant kept. The real clause of the done-when holds.

## Checks on pilot output

Pairs and targets each screen holds, counted by a throwaway copy of the engine with the threshold set to 22 and the floor to 10000. The blank system has one theme.

| Screen | V11 pairs | V12 targets |
| --- | --- | --- |
| home-start | 4 | 3 |
| reminder-confirmed | 3 | 1 |
| reminder-setup | 6 | 3 |
| session-complete | 2 | 1 |
| session-guided | 2 | 1 |
| session-intro | 3 | 2 |

Kairos has a dark and a light theme. Each pair is read once in each, and counted once below.

| Screen | V11 pairs | V12 targets |
| --- | --- | --- |
| duel-attente | 3 | 2 |
| duel-choix-adversaire | 3 | 2 |
| duel-invitation | 9 | 7 |
| duel-resultat | 3 | 2 |
| duel-seance-active | 4 | 2 |
| pratiques-config | 5 | 4 |
| pratiques-liste | 2 | 2 |
| pratiques-resultat | 11 | 5 |
| pratiques-seance-active | 5 | 3 |

With the real engine, every screen of both pilots passes both.

The Kairos output changed V12 twice, each fix test first:

- Kairos writes sizes as `calc(var(--12) * 1px)`. `extract` had typed its spacing and font sizes `number`: their tokens drop the export's name, where the size word sat. `extract` now reads that name, and they are px dimensions. On a copy, the 38 tokens its screens scaled by `1px` all are. V12 reads no `calc()`.
- Any `role` made an element a control, so a `role="status"` label and a `role="progressbar"` bar were flagged. Only the control roles Kairos uses count now: `link`, `radio`, `switch`, `tab`.

On a copy of the blank output, one screen's text set to its background token and one button's height set to a 16px token:

```txt
V11 light: .session-intro-screen: var(--color-surface-page) (#f7f9fa) on var(--color-surface-page) (#f7f9fa) is 1.00:1, below 4.5
V12 button (.session-intro-screen .primary-button): min-height 16px is below the 24px floor of web
```

A text colour set on a rule without a background is not checked: no inheritance, as the plan states.

## Mutations

Each guard broken once, its own test red, then restored.

| Guard | Mutation | Red test |
| --- | --- | --- |
| R19 absent key | nothing returned without `wireframe` | warns of a screen with no wireframe |
| R19 unknown id | nothing returned for an unknown id | names a wireframe no record has |
| R19 wrong kind | any kind accepted | names a wireframe that is a record of another kind |
| R19 severity | absent key written as an error | warns of a screen with no wireframe, and never errs for it |
| Six-digit hex | `{6}` written `{7}` | reads a six-digit hex |
| Three-digit hex | `{3}` written `{4}` | reads a three-digit hex |
| `rgba()` | `rgba?` written `rgbx?` | reads rgba() with its alpha |
| `rgb()` | `rgba?` written `rgba` | reads rgb() with commas, and with spaces and a slash alpha |
| `color(srgb)` | `color\(` written `colorx\(` | reads color(srgb) channels as they are |
| `transparent` | keyword never matched | reads transparent as fully clear |
| Composition | `over` ignores alpha | mixes a translucent colour with what is behind it |
| Opaque pair | opaque background unused | names an opaque pair below it, in every theme that shows it |
| Translucent pair | no composition over the body | composes a translucent background over the body's |
| Translucent text | text alpha ignored | composes a translucent text over its background |
| Threshold | 4.5 written 4.4, then 4.6 | the 4.48 and 4.54 test, both sides |
| Theme iteration | base only | reads each theme with its own values: fails in dark only |
| Default floor | 24 written 20, then 25 | names a target below it; passes a target at the default floor |
| Raised floor | `touch-target` ignored | takes the highest floor of the system's platforms |
| Not below 24 | `Math.max` removed | lowers nothing below 24 |
| Highest platform | first, then last | takes the highest floor, whatever their order |
| Screen platforms | system's used instead | takes the platforms of the screen over the system's |
| Unitless | unread | reads a unitless size as px |
| px | scaled by 16 | names a target below it |
| rem | not scaled | reads rem as 16px |
| Tag match | off | targets an element by its tag |
| Class match | off | names a target below it |
| Size properties | `height` unread | reads height, block-size and min-block-size too |
| Role | not interactive | targets an element carrying a role |
| Export's size word | export's name left out of the guess | reads a bare number as px when its export names a size, though the token drops that name |
| Control roles | any role accepted | leaves an element whose role is no control |
| Control roles | `tab` removed | targets an element carrying a role |
| Pilot screens check | screen `id` read instead of `wireframe` | lists no wireframe when a screen names each by its wireframe key |

## Limits

- Haiku runs the pilot; Kairos is a `git archive` copy, the checkout only read.
- Gouvernail was not run: its checkout no longer exists on this machine.
- Screen variants were compared and kept by the model; no page was handed to a person.
