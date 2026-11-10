# aidd-ui: the comparison page as a product tool

## Goal

A person opens `drafts/<set>/compare.html` from disk and reviews a set of variants the way a design tool works: a list on the left, the variants on a grey canvas, the selected one in an inspector on the right. They rate, discard and comment without hunting for controls, see how far they are, and hand the feedback back with one click.

Only `plugins/aidd-ui/hooks/lib/page.cjs` and its tests in `scripts/__tests__/aidd-ui/drafts.test.js` change. `drafts.cjs`, `help.cjs` and the skills do not.

```txt
┌ brand · 3 variants ─── Theme▾ State▾ ── 2/3 decided ── [Copy feedback] ┐
├──────────┬──────────────────────────────────────┬────────────────┤
│ VARIANTS │  ░░░░░░░░░ grey canvas ░░░░░░░░░░░░  │ a              │
│ ● a ★★★★ │  a ─────────────┐  c ─────────────┐ │ Calm           │
│ ○ b ✕    │  │ preview a    │  │ preview c    │ │ Tone   calm    │
│ ○ c ★★★★★│  │              │  │              │ │ Density roomy  │
│ ⇧click = │  └──────────────┘  └──────────────┘ │ Rating ★★★★☆   │
│ compare  │                                      │ [ ] Discard    │
│          │                                      │ Comment…       │
├──────────┴──────────────────────────────────────┴────────────────┤
│ 1-5 rate · X discard · ←→ variant · C copy      ▸ Show JSON       │
└──────────────────────────────────────────────────────────────────┘
```

## What stays

The contract the current tests and `help compare` hold. The redesign moves markup around it, never through it.

| Stays | Detail |
| --- | --- |
| One file | static HTML, opened as `file://`, no server, no request, no external font, script or stylesheet |
| Copied text | `copiedOf(stateOf())`: a json fence of `{"set", "variants": [{name, rating 1-5 or null, discarded, comment trimmed}]}`, in `variants.md` order. `feedbackOf` and `copiedOf` are carried as the module has them |
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

Existing guards restrict the new chrome. The no-address test forbids any `src=` or `href=` attribute, so no anchor, skip link included. The `https?://` test forbids inline SVG carrying `xmlns`, so stars and ✕ are text glyphs. The no-connection test matches the bare word `fetch`, in comments and strings too.

## The page

Four regions: top bar, variant list, canvas, inspector, plus a bottom strip. UI strings are English.

### Top bar

| # | Statement |
| --- | --- |
| P1 | It shows the set name and `N variants`. |
| P2 | It holds the Theme and State selects as today. |
| P3 | `#progress` reads `n/N decided`, n the variants rated or discarded. It reads `0/N decided` in the written file and updates on every change. |
| P4 | `#copy` is a `<button type="button">`, the primary action, labelled `Copy feedback`. |
| P5 | After the clipboard accepts the text, its label reads `Copied`. It reverts to `Copy feedback` on the next change to the feedback. No timer. |
| P6 | When the clipboard refuses, the page opens the JSON disclosure, then selects the whole feedback text. The label never reads `Copied` on this path. |

### Variant list

| # | Statement |
| --- | --- |
| L1 | `<nav aria-label="Variants">` holds one `<button type="button" class="pick" data-name>` per variant, in `variants.md` order. |
| L2 | Each button shows the name and its rating as filled stars, nothing when unrated. |
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
| I3 | Rating is a group (`role="group"`, `aria-label="Rating"`) of five `<button type="button" class="star" aria-pressed>`, each labelled `Rate k of 5`. |
| I4 | Pressing star k sets the rating to k; pressing the current rating's star clears it to null. The panel's `data-rating` holds `""` or `1`-`5`, which `stateOf` reads. |
| I5 | Discard is a checkbox labelled `Discard`. |
| I6 | Comment is a `<textarea class="comment">` labelled `Comment`. |
| I7 | Every change in a panel updates the list, `#progress` and `#feedback` at once. |

### Bottom strip

| # | Statement |
| --- | --- |
| B1 | It lists the shortcuts: `1-5 rate · X discard · ←→ variant · C copy`. |
| B2 | `<details>` with summary `Show JSON` holds `#feedback`, closed in the written file. |

### Chrome theme and accessibility

| # | Statement |
| --- | --- |
| A1 | Chrome colours are custom properties, redefined under `@media (prefers-color-scheme: dark)`. No toggle. |
| A2 | The chrome theme never reaches a preview: frames keep the Theme select's control, and render the same under both schemes. |
| A3 | Every control is a native `button`, `input`, `select` or `textarea`. |
| A4 | Every focusable control shows an outline on `:focus-visible`. |
| A5 | All text meets WCAG AA 4.5:1 against its background in both schemes, the dimmed name of a discarded variant included. |
| A6 | Every button, checkbox and star is at least 24 by 24 CSS px. |

## Keyboard

Shortcuts act on the selected variant.

| Key | Effect |
| --- | --- |
| `1`-`5` | sets the rating; the current rating's digit clears it |
| `X` | toggles discard |
| `←` `→` | selects the previous or next variant, shown alone; nothing at either end |
| `C` | copies, as the button does, label included |

| # | Statement |
| --- | --- |
| K1 | No shortcut fires while focus is in a `textarea` or a `select`. Typing `x`, `c` or a digit in the comment only types it; arrows in a select only change it. |
| K2 | No shortcut fires while Ctrl, Meta or Alt is held, so Cmd/Ctrl+C still copies a selection. |
| K3 | Shift with a key is no shortcut either; pairing is pointer only. |

## Out of scope

| Left out | Why |
| --- | --- |
| Zoom, pan, drag, resizing frames | a review of two to five variants fits the canvas |
| More than two side by side | the mockup shows two; three already squeezes previews |
| Pairing from the keyboard | shift-click alone; the keyboard reviews one variant at a time |
| Persistence across reload | a reload loses ratings and comments; the session is short and ends in a copy |
| A chrome theme toggle | the system scheme decides |
| Narrow screens | opened on a desktop beside the chat; no layout below about 1024px wide |
| Device sizes or per-frame themes | the Theme select applies to all frames |
| i18n | UI strings are English |
| Save to a file | dropped before: the person never picks a folder |
| Any change to the copied format, `drafts.cjs` or `help.cjs` | the skills read the format as it is |

## Acceptance criteria

Node tests see only the written HTML. Behaviour is proven by one browser pass with `npx --yes @playwright/cli@0.1.17` over `file://`, in Chromium, Firefox and WebKit, with screenshots in light and dark schemes, results written to `page/run.md` in the shape of `run-4b.md`. Console: no error in any engine.

| # | Criterion | Proven by |
| --- | --- | --- |
| 1 | Every test in "the comparison page" still passes. Only the variant order test is rewritten, to read both `.pick` buttons and canvas sections in `variants.md` order. | node |
| 2 | The page has `<nav aria-label="Variants">`, `<main id="canvas">`, `<aside id="inspector">` and `#progress` reading `0/N decided` (P3, L1, I1). | node |
| 3 | One `.pick` button, one canvas section and one `.panel` per variant, each in `variants.md` order (L1, I1). | node |
| 4 | Only the first variant's canvas section and panel lack `hidden`; only its button carries `aria-current="true"` (L4, C3, I1). | node |
| 5 | Each panel holds five `.star` buttons with `aria-pressed="false"`, a discard checkbox and a `.comment` textarea (I3, I5, I6). | node |
| 6 | `#feedback` sits inside a closed `<details>` whose summary reads `Show JSON`; `#copy` is `type="button"` (P4, B2). | node |
| 7 | The style redefines its colour properties under `@media (prefers-color-scheme: dark)` (A1). | node |
| 8 | run-4b's checks hold in all three engines: switch variants, two side by side, discard then undo, theme and state applied to a hidden frame then shown, frame height once shown, rating and comment in the feedback. | browser |
| 9 | After rating two of three, `#progress` reads `2/3 decided`; discarding the third makes it `3/3 decided` (P3). | browser |
| 10 | Copy with the clipboard granted: label `Copied`, clipboard text equal to `#feedback`, byte for byte the same in the three engines. A rating change reverts the label (P5). | browser |
| 11 | Copy with the clipboard forced to refuse: disclosure open, whole text selected, label never `Copied` (P6). | browser |
| 12 | Shift-click pairs, shift-click again unpairs, shift-click a third replaces the second; a frame click moves the inspector, pair kept (L6, C6). | browser |
| 13 | Keys `1`-`5`, `X`, `←` `→`, `C` act as the keyboard table says; typing `x1c` in the comment changes only the comment; Ctrl/Meta+C fires no copy (K1, K2). | browser |
| 14 | A star can be set and cleared with Tab and Enter alone; focus outline visible in the screenshot (I3, I4, A4). | browser |
| 15 | Bounding boxes of every button, checkbox and star are at least 24 by 24 px (A6). | browser |
| 16 | Contrast computed from used colours meets 4.5:1 for chrome text, muted text, the primary button and a discarded name, in both schemes (A5). | browser |
| 17 | A variant's frame screenshot is the same under light and dark chrome (A2). | browser |
| 18 | `pnpm exec lefthook run pre-commit` passes; the scripts suite passes wrapped. | command |

Each node guard ships with the mutation that turns its own test red:

| Guard | Mutation | Red test |
| --- | --- | --- |
| 2 Regions and progress | `#progress` written as `1/N decided` | criterion 2 |
| 3 One of each per variant | panels written in reverse order | criterion 3 |
| 4 First shown | `hidden` dropped from every panel | criterion 4 |
| 5 Panel controls | four stars instead of five | criterion 5 |
| 6 JSON disclosure | `#feedback` moved out of `<details>` | criterion 6 |
| 7 Chrome dark scheme | the media query removed | criterion 7 |
| 1 Order, rewritten | list buttons written in reverse | criterion 1's order test |

Script behaviour (selection, pairing, keys, copy label) has no node guard: node cannot run it. The browser pass is its proof.

## Risks and open questions

1. **The chrome scheme may leak into previews.** A frame whose used `color-scheme` differs from its parent's gets an opaque backdrop in some engines. Default: set `color-scheme` on the chrome regions, never on `:root` or the iframe element. Criterion 17 decides; if it fails, the chrome drops `color-scheme` and styles its own controls.
2. **Reload loses everything.** Left out on purpose; if a person reloads mid-review in practice, persistence becomes the next change, not this one.
