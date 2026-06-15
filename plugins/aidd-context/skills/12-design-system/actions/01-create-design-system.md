# 01 - Create design system

A setup runbook: run Impeccable's commands in sequence, each setting up part of the design system. Output is Impeccable's canonical `DESIGN.md` (+ `PRODUCT.md` + `.impeccable/design.json`); this action only adds the ordering, the routing, and the per-step checks. Walk it as a todo: tick each checkbox once the command has produced it.

## Inputs

- `project` (optional, default: CWD) - project root to set the design system up in.
- `brand_intent` (optional) - a brand/product phrase if the user already has one; otherwise Impeccable's interview gathers it.

## Outputs

Impeccable-owned, at the project root (this action drives the commands, it doesn't write them):

```
PRODUCT.md                 # strategy: register, users, brand, anti-references
DESIGN.md                  # the single source of truth: tokens + 6 Stitch sections
.impeccable/design.json    # sidecar: ramps, shadows, motion, components
```

## Process

Run the commands in order. **Each step IS an Impeccable command**; tick its checkboxes once they hold.

### Step 0 - Ensure the engine

- [ ] `/impeccable` responds (installed). If absent, guide install (<https://impeccable.style>), then stop. Never emulate it.

### Step 1 - `/impeccable init`

Strategic foundation every later command reads. `init` defers all visual choices to `document` - it does not touch colors, fonts, or radii.

- [ ] Register chosen: brand (design IS the product) vs product (design SERVES it)
- [ ] `PRODUCT.md` written: users, brand personality, anti-references, principles

### Step 2 - `/impeccable document`

The visual system, written to the canonical `DESIGN.md` + `.impeccable/design.json` sidecar (scan mode if code exists, seed mode if not).

- [ ] Color strategy (Restrained / Committed / Full / Drenched) + one concrete mood sentence (not "modern/clean")
- [ ] Brand seed as OKLCH anchor (`palette.mjs` runs at Impeccable setup for new projects)
- [ ] Colors: semantic roles (primary/secondary/tertiary/neutral), OKLCH, descriptive slugs
- [ ] 8-step tonal ramp per major color (sidecar)
- [ ] Typography: pairing on a contrast axis, <=3 families
- [ ] Type scale + hierarchy (display/headline/title/body/label), step ratio >=1.25
- [ ] Readability: line 65-75ch, clamp <=6rem, letter-spacing >=-0.04em, no all-caps body
- [ ] Spacing + radius token scales
- [ ] Elevation strategy stated (flat / tonal / shadows)
- [ ] Motion tokens + `prefers-reduced-motion` alternative
- [ ] Components documented with all states (default/hover/focus/active/disabled/loading/error)
- [ ] `DESIGN.md`: the six Stitch sections in order + token frontmatter
- [ ] Do's & Don'ts (section 6) tie to `PRODUCT.md` anti-references

### Step 3 - `/impeccable extract` (existing codebases only)

- [ ] Repeated patterns + hard-coded values consolidated into reusable tokens/components, folded into `DESIGN.md`

### Step 4 - Refine the weak axis (only what the baseline flags; skip sound axes)

- [ ] Weak axis addressed: `typeset` (type) - `colorize` (color) - `layout` (rhythm) - `animate` (motion)

### Step 5 - `/impeccable audit` + `/impeccable critique`

Validate and capture the backlog.

- [ ] Contrast: body >=4.5:1, large >=3:1, placeholder >=4.5:1, UI >=3:1; no gray-on-tint; color-blind safe
- [ ] `audit` reports no P0 (a11y, responsive, anti-patterns)
- [ ] `critique` score snapshot + P0/P1 backlog captured

### Step 6 - Showcase & sign-off

See the whole system rendered, then validate it.

- [ ] Design system reviewed visually - `/impeccable live` (in-browser panel: color tiles + component primitives from `DESIGN.md`/sidecar; needs a dev server, renders even day-zero) OR `/impeccable craft "design-system styleguide page"` for a built, shareable showcase
- [ ] Tokens + components match the intended brand; signed off

**Ongoing (later, not this flow):** evolve via `/impeccable shape` / `craft` / `live` / `harden` / `polish`, re-`critique` to track the trend.

## Test

After running: `DESIGN.md` exists at the project root with the six section headers (Overview, Colors, Typography, Elevation, Components, Do's and Don'ts) + a token frontmatter block, and `/impeccable audit` reports no P0 contrast failure. Real-execution on disk, never mocked.
