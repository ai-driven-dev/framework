# aidd-ui: the comparison page as a product tool

## Goal

A person opens `drafts/<set>/compare.html` from disk and reviews a set of variants the way a design tool works: a list on the left, the variants on a grey canvas, the selected one in an inspector on the right. They give each variant a verdict and a comment, see how far they are, lose nothing on reload, and hand the feedback back with one click.

Changes: `plugins/aidd-ui/hooks/lib/page.cjs`, the `compare` entry of `help.cjs`, the weighing sub-steps of three skills, and their tests in `scripts/__tests__/aidd-ui/`. `drafts.cjs` does not change.

```txt
┌ brand · 3 variants ─── Theme▾ State▾ ── 2/3 decided ── [Copy feedback] ┐
├──────────┬──────────────────────────────────────┬────────────────┤
│ VARIANTS │  ░░░░░░░░░ grey canvas ░░░░░░░░░░░░  │ a              │
│ ● a Keep │  a ─────────────┐  c ─────────────┐ │ Calm           │
│ ○ b̶      │  │ preview a    │  │ preview c    │ │ Tone   calm    │
│ ○ c      │  │              │  │              │ │ Density roomy  │
│ ⇧click = │  └──────────────┘  └──────────────┘ │ [Keep][Revise] │
│ compare  │                                      │ [Discard]      │
│          │                                      │ Comment…       │
├──────────┴──────────────────────────────────────┴────────────────┤
│ K keep · R revise · D discard · ←→ variant · C copy  ▸ Show JSON │
└──────────────────────────────────────────────────────────────────┘
```

## Verdict

One per variant, chosen by the person:

| Verdict | Means |
| --- | --- |
| `keep` | take it as it is |
| `revise` | a lead; the comment says what to change |
| `discard` | no |
| `null` | not looked at yet |

## The copied format

`copiedOf(stateOf())`: a json fence of `{"set": "<set>", "variants": [{"name", "verdict", "comment"}]}`. All three fields always; `verdict` is `"keep"`, `"revise"`, `"discard"` or `null`; the comment trimmed; `variants.md` order. `feedbackOf` and `copiedOf` stay self-contained and carried into the page as the module has them.

`help compare` states it in two output lines, replacing the `rating` one:

- `An entry is {"name", "verdict", "comment"}.`
- `A verdict is "keep", "revise", "discard", or null if undecided.`

And one effect line: `The page remembers the review across reloads, until the set changes.`

## What stays

The contract the current tests and `help compare` hold, the format above aside. The redesign moves markup around it, never through it.

| Stays | Detail |
| --- | --- |
| One file | static HTML, opened as `file://`, no server, no request, no external font, script or stylesheet |
| Copy fallback | when the clipboard refuses, the page selects the whole text |
| Feedback field | `<textarea id="feedback" readonly>`, filled by the literal `out.value = copiedOf(stateOf());` |
| Ids | `copy` (the button), `theme`, `state` (its empty "all" option first). Each select exists only when the set has themes or states |
| Theme and state | applied into every frame, hidden ones included, on load and on change |
| Tokens | `tokens.css` inlined in each render; no `../tokens.css` left |
| Frames | one `<iframe srcdoc>` per HTML file of a variant, never cloned. Showing or pairing toggles `hidden` on existing frames |
| Text files | each `.md` file of a variant in a `<pre>` inside that variant's frame, under its path |
| Canvas markup | `<section class="variant" data-name="<name>">` per variant, in `variants.md` order |
| Per variant | its intent text and each axis value as `<dd>` |
| Determinism | two runs write the same bytes |

Existing guards restrict the new chrome. The no-address test forbids any `src=` or `href=` attribute, so no anchor, skip link included. The `https?://` test forbids inline SVG carrying `xmlns`, so marks are text glyphs. The no-connection test matches the bare word `fetch`, in comments and strings too.

## The page

Four regions: top bar, variant list, canvas, inspector. UI strings are English.

### Top bar

| # | Statement |
| --- | --- |
| P1 | It shows the set name and `N variants`. |
| P2 | It holds the selects as today, labelled `Preview theme` and `Preview state`: they act on previews, not on the chrome. |
| P3 | `#progress` reads `n/N decided`, n the variants whose verdict is not null. It reads `0/N decided` in the written file and updates on every change. |
| P4 | `#copy` is a `<button type="button">`, the primary action, labelled `Copy feedback`. |
| P5 | After the clipboard accepts the text, its label reads `Copied`. It reverts to `Copy feedback` on the next change to the feedback. No timer. |
| P6 | When the clipboard refuses, the page opens the JSON disclosure, then selects the whole feedback text. The label never reads `Copied` on this path. |

### Variant list

| # | Statement |
| --- | --- |
| L1 | `<nav aria-label="Variants">` holds one `<button type="button" class="pick" data-name>` per variant, in `variants.md` order. |
| L2 | Each button shows the name and its verdict word, nothing when null. |
| L3 | A discarded variant's button is dimmed and its name struck through, and its accessible name includes `discarded`. |
| L4 | The selected variant's button carries `aria-current="true"`. In the written file, the first one does. |
| L5 | A click selects the variant: the canvas shows its frame alone, the inspector shows its panel. |
| L6 | A shift-click on another variant shows the selected one and that one side by side, in `variants.md` order. Shift-click on the paired one again unpairs. Shift-click on a third replaces the pair's second. |
| L7 | A hint under the list reads `Shift-click to compare`. |

### Canvas

| # | Statement |
| --- | --- |
| C1 | `<main id="canvas">` has a grey background distinct from the chrome, in both schemes. |
| C2 | Each frame carries its name as a small label above it, like a design tool's frame. |
| C3 | Only shown frames lack `hidden`. In the written file, only the first variant's frame is shown. |
| C4 | One shown frame takes the canvas width; two share it equally. |
| C5 | A frame's height is today's fixed height; taller content scrolls inside it. |
| C6 | A click on a shown frame selects that variant, the pair unchanged. |

### Inspector

| # | Statement |
| --- | --- |
| I1 | `<aside id="inspector">` holds one `<section class="panel" data-name>` per variant; only the selected one lacks `hidden`. |
| I2 | A panel shows the name, the intent, and the axes as a `<dl>`. |
| I3 | Verdict is a group (`role="group"`, `aria-label="Verdict"`) of three `<button type="button" class="verdict" data-verdict aria-pressed>`, labelled `Keep`, `Revise`, `Discard`. |
| I4 | Pressing a verdict sets it; pressing the active one clears it to null. The panel's `data-verdict` holds `""` or the verdict, which `stateOf` reads. |
| I5 | Comment is a `<textarea class="comment">` labelled `Comment`. |
| I6 | Every change in a panel updates the list, `#progress` and `#feedback` at once. |

### Shortcuts and JSON

Both sit at the foot of the inspector.

| # | Statement |
| --- | --- |
| B1 | It lists the shortcuts as key caps in two columns: `K` keep, `R` revise, `D` discard, `←→` variant, `C` copy. |
| B2 | `<details>` with summary `Show JSON` holds `#feedback`, closed in the written file. |

### Chrome theme and accessibility

| # | Statement |
| --- | --- |
| A1 | Chrome colours are custom properties, redefined under `@media (prefers-color-scheme: dark)`. No toggle. |
| A2 | The chrome theme never reaches a preview: frames keep the Theme select's control, and render the same under both schemes. |
| A3 | Every control is a native `button`, `select` or `textarea`. |
| A4 | Every focusable control shows an outline on `:focus-visible`. |
| A5 | All text meets WCAG AA 4.5:1 against its background in both schemes, the dimmed name of a discarded variant included. |
| A6 | Every button is at least 24 by 24 CSS px. |

### Visual design

The page reads like a current design tool: quiet chrome, the work in the middle, colour only where it carries meaning. No request, so system fonts only, and no inline SVG.

| # | Statement |
| --- | --- |
| V1 | Type: `ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`, 13px chrome, 15px document text. Mono only for the JSON and inline code. Two weights: 400 and 600. |
| V2 | Spacing on a 4px grid. Radius 6px on controls, 10px on cards. Hairline borders, one neutral tone. Shadows only on canvas cards. |
| V3 | Light: white chrome, canvas a soft grey with a faint dot grid. Dark: near-black chrome, canvas a step lighter. One blue accent, for the primary button, selection and focus. |
| V4 | Verdict colours: keep green, revise amber, discard red. Each has a tinted background and a strong foreground, in both schemes. They appear on the pressed verdict button and as a status dot in the list. Nowhere else. |
| V5 | Top bar, 48px: a small square mark and the set name, a `N variants` pill, then `Preview theme` and `Preview state` as styled selects (`appearance: none`, a text chevron). Right side: a thin progress bar beside `n/N decided`, then the primary `Copy feedback` button with its `C` key hint. |
| V6 | Variant list: a `Variants` caption in small caps. Each row: status dot (empty ring when undecided), name, intent on a second muted line, cut with an ellipsis. Selected row: accent tint. Paired row: a small `B` badge, the selected one `A`. The hint below shows `⇧` as a key. |
| V7 | Canvas: each frame is a white card with its name and file as a label above it, like a design tool's frame. A markdown file renders as a document, at most 68 characters wide: front matter as small chips, then headings, paragraphs, lists, tables and inline code. Any other line stays a plain paragraph. An html file shows in its frame, without border. |
| V8 | Inspector: name 16px semibold, intent, axes as rows split by hairlines. `Verdict` caption, then a segmented control of three equal buttons with glyphs `✓ Keep`, `↻ Revise`, `✕ Discard`. Comment textarea with the placeholder `What should change?`. Below, the shortcuts as key caps, then the `Show JSON` disclosure. The bottom strip goes. |
| V9 | Keys shown as `<kbd>` caps: hairline border, small radius, mono 11px. |
| V10 | Hover and press states on every button. Transitions 120ms, none under `prefers-reduced-motion: reduce`. |
| V11 | Below 900px wide, regions stack: top bar, list as a horizontal row, canvas, inspector. No horizontal page scroll at 375px. |

## Memory across reload

| # | Statement |
| --- | --- |
| M1 | The engine writes into the page a fingerprint of what it shows: a hash, by `node:crypto`, of each variant's name and each file's path and text, in `variants.md` order. Nothing else enters it, so a second `compare` over the same set writes the same bytes. |
| M2 | The script stores the review under `aidd-ui:<set>:<fingerprint>`: each verdict and comment, the selected variant, the paired one. It saves on every change. |
| M3 | On load, the page restores what that key holds into panels, list, `#progress`, `#feedback` and canvas. |
| M4 | A changed set changes the fingerprint, so a new round starts empty. |
| M5 | Every storage access sits in `try`/`catch`. With storage absent, blocked or throwing, the page works fully and remembers nothing. |

The Theme and State selects are not remembered. Keys of past rounds are never removed: a few hundred bytes each.

## Keyboard

Shortcuts act on the selected variant.

| Key | Effect |
| --- | --- |
| `K` `R` `D` | sets keep, revise or discard; the active verdict's key clears it |
| `←` `→` | selects the previous or next variant, shown alone; nothing at either end |
| `C` | copies, as the button does, label included |

| # | Statement |
| --- | --- |
| K1 | No shortcut fires while focus is in a `textarea` or a `select`. Typing `k`, `r`, `d` or `c` in the comment only types it; arrows in a select only change it. |
| K2 | No shortcut fires while Ctrl, Meta or Alt is held, so Cmd/Ctrl+C still copies a selection. |
| K3 | Shift with a key is no shortcut either; pairing is pointer only. |

## Skills

The weighing sub-steps of `02-brand/actions/03-choose.md`, `03-foundations/actions/02-write.md` and `04-components/actions/02-write.md` trade ratings for the verdict meanings: sentences of 12 words at most, no engine rule, no other skill named. Each keeps its tie-break (brand: ask; foundations: nearer the brand; components: fewer states). Brand:

```md
3. Weigh the feedback.
   - Keep: a candidate as it is.
   - Revise: a lead. Its comment says what to change.
   - Discard: out.
   - No verdict: not looked at. Ask before deciding.
   - Several kept: ask which one. The user makes the choice.
   - If nothing is kept, read propose, linked,  with the comments.
```

Foundations and components: revise-only feedback means revise per the comments, then compare again.

## Out of scope

| Left out | Why |
| --- | --- |
| Zoom, pan, drag, resizing frames | a review of two to five variants fits the canvas |
| More than two side by side | the mockup shows two; three already squeezes previews |
| Pairing from the keyboard | shift-click alone; the keyboard reviews one variant at a time |
| A chrome theme toggle | the system scheme decides |
| Narrow screens | opened on a desktop beside the chat; no layout below about 1024px wide |
| Device sizes or per-frame themes | the Theme select applies to all frames |
| i18n | UI strings are English |
| Save to a file | dropped before: the person never picks a folder |

## Acceptance criteria

Node tests see only the written HTML and the help text. Behaviour is proven by one browser pass with `npx --yes @playwright/cli@0.1.17` over `file://`, in Chromium, Firefox and WebKit, with screenshots in light and dark schemes, results written to `page/run.md` in the shape of `run-4b.md`. Console: no error in any engine.

| # | Criterion | Proven by |
| --- | --- | --- |
| 1 | Every test in "the comparison page" still passes. Rewritten: the variant order test, to read both `.pick` buttons and canvas sections in `variants.md` order; the `feedbackOf` and `copiedOf` tests, to the verdict format with a null verdict and a trimmed comment. | node |
| 2 | The page has `<nav aria-label="Variants">`, `<main id="canvas">`, `<aside id="inspector">` and `#progress` reading `0/N decided` (P3, L1, I1). | node |
| 3 | One `.pick` button, one canvas section and one `.panel` per variant, each in `variants.md` order (L1, I1). | node |
| 4 | Only the first variant's canvas section and panel lack `hidden`; only its button carries `aria-current="true"` (L4, C3, I1). | node |
| 5 | Each panel holds three `.verdict` buttons, `keep`, `revise`, `discard`, with `aria-pressed="false"`, and a `.comment` textarea (I3, I5). | node |
| 6 | `#feedback` sits inside a closed `<details>` whose summary reads `Show JSON`; `#copy` is `type="button"` (P4, B2). | node |
| 7 | The style redefines its colour properties under `@media (prefers-color-scheme: dark)` (A1). | node |
| 8 | The page holds the key `aidd-ui:<set>:<fingerprint>`, a hex fingerprint (M1, M2). | node |
| 9 | Two `compare` runs over the same set write the same fingerprint (M1). | node |
| 10 | Changing one variant file's text changes the fingerprint (M4). | node |
| 11 | `help compare` names `verdict` in its entry line and no longer `rating`. | node |
| 12 | run-4b's checks hold in all three engines: switch variants, two side by side, discard then undo, theme and state applied to a hidden frame then shown, frame height once shown, verdict and comment in the feedback. | browser |
| 13 | After keep and revise on two of three, `#progress` reads `2/3 decided`; discarding the third makes it `3/3`; clearing one makes it `2/3` (P3, I4). | browser |
| 14 | Copy with the clipboard granted: label `Copied`, clipboard text equal to `#feedback`, byte for byte the same in the three engines. A verdict change reverts the label (P5). | browser |
| 15 | Copy with the clipboard forced to refuse: disclosure open, whole text selected, label never `Copied` (P6). | browser |
| 16 | Shift-click pairs, shift-click again unpairs, shift-click a third replaces the second; a frame click moves the inspector, pair kept (L6, C6). | browser |
| 17 | Keys `K` `R` `D`, `←` `→`, `C` act as the keyboard table says; typing `krdc` in the comment changes only the comment; Ctrl/Meta+C fires no copy (K1, K2). | browser |
| 18 | A verdict can be set and cleared with Tab and Enter alone; focus outline visible in the screenshot (I3, I4, A4). | browser |
| 19 | Bounding boxes of every button are at least 24 by 24 px (A6). | browser |
| 20 | Contrast computed from used colours meets 4.5:1 for chrome text, muted text, the primary button and a discarded name, in both schemes (A5). | browser |
| 21 | A variant's frame screenshot is the same under light and dark chrome (A2). | browser |
| 22 | Verdicts, comments, selection and pair set, then reload: all restored, `#feedback` equal to before, in all three engines (M3). | browser |
| 23 | The page regenerated after a variant file changed opens empty, `0/N decided` (M4). | browser |
| 24 | With `localStorage` access forced to throw, the page loads without console error, and criteria 13 and 14 hold; a reload restores nothing (M5). | browser |
| 25a | A markdown variant renders headings as `h1` to `h3` and a table as `<table>`, never inside `<pre>` (V7). | node |
| 25b | Screenshots at 1280 and 375px wide, light and dark, in the three engines; no horizontal scroll at 375 (V11). | browser |
| 25 | `pnpm exec lefthook run pre-commit` passes; the scripts suite passes wrapped. | command |

Each node guard ships with the mutation that turns its own test red:

| Guard | Mutation | Red test |
| --- | --- | --- |
| 2 Regions and progress | `#progress` written as `1/N decided` | criterion 2 |
| 3 One of each per variant | panels written in reverse order | criterion 3 |
| 4 First shown | `hidden` dropped from every panel | criterion 4 |
| 5 Panel controls | two verdict buttons instead of three | criterion 5 |
| 6 JSON disclosure | `#feedback` moved out of `<details>` | criterion 6 |
| 7 Chrome dark scheme | the media query removed | criterion 7 |
| 8 Key in the page | the key left out of the script | criterion 8 |
| 9 Stable fingerprint | the current time hashed in | criterion 9 |
| 10 Fingerprint follows content | file texts left out of the hash | criterion 10 |
| 11 Help names verdict | the `rating` entry line restored | criterion 11 |
| 1 Order, rewritten | list buttons written in reverse | criterion 1's order test |
| 25a Markdown document | text files written back into `<pre>` | criterion 25a |
| 1 Feedback, rewritten | `verdict` emitted as `""` instead of null | criterion 1's feedback test |

Script behaviour (selection, pairing, keys, copy label, storage) has no node guard: the browser pass is its proof. The skills' wording is checked by reading.

## Risks and open questions

1. **The chrome scheme may leak into previews.** A frame whose used `color-scheme` differs from its parent's gets an opaque backdrop in some engines. Default: set `color-scheme` on the chrome regions, never on `:root` or the iframe element. Criterion 21 decides; if it fails, the chrome drops `color-scheme` and styles its own controls.
2. **Chromium shares one `localStorage` across every `file://` page.** Every comparison page on the machine sees the same store, hence a key naming both the set and the fingerprint.
3. **An engine may refuse storage on `file://`.** M5 keeps the page working; if criterion 22 fails for that reason, the run stops for a decision. No fallback store.
4. **Open: does a lone `revise` always mean a new round?** Default: yes. Revising then keeping without a second look is faster but unreviewed.
