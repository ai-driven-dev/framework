# 02 - Design

Describe a frontend page's design before code - its components and their behavior, the dumb/smart split, the render decision - then write the **delegation prompt** that tells the implementer how to build it.

This action describes and delegates. It writes no code, and (running under the `planner`) it does **not** spawn the implementer - the implementation side launches it with the prompt written here.

## Input

The page or feature to design (free text). Nothing else.

## Output

The page, **described**: what it is, its components and their behavior, the dumb/smart split. Plus a bullet list (or small table) of the elements covered, and the delegation prompt for the implementer.

## Requirement

`impeccable` skill installed.

## Process

1. **Describe the page.** Purpose, sections, components. Per component, its behavior (states + transitions) - the SMART layer, owned in-house.
2. **Dumb/smart split.** Mark the **presentational (dumb)** components - props in, UI out, no data/logic/routing/state. Their visual is delegated to the design tool; its `shape` defines the visual behaviors (one line, not re-specified here).
3. **Render decision.** Ask the user once: see the page rendered, or not?
4. **Write the delegation prompt** for the implementer. It must:
   - Keep the smart layer (data, state, routing, wiring) in your own code. Author the visual via the design tool with quotes - never `craft` (that builds the feature): `Use skill "impeccable" with "shape <page/component> - dumb/presentational, props only, tokens from DESIGN.md"`.
   - **If render was requested - visual-first.** Craft the page's visual **end-to-end first**, then **verify it in-browser before any wiring**: `Use skill "impeccable" with "live"` to iterate variants until visually good, with `Use skill "impeccable" with "critique <page>"` as the gate. Run under `/goal` (`aidd-dev:09-for-sure`): loop until **zero P0**, then explicit user OK. Only then **attach the verified visual to the code** (wire the smart layer onto it).
   - **If not.** Author the dumb visuals inline and wire as you go - no `live`, no loop.
5. **Present** the description + element list + delegation prompt. Wait for an explicit OK before exiting.

## Test

The page is described with its components and their behavior; the dumb components are marked; the render decision is recorded; and a delegation prompt exists that builds the smart layer in-house and delegates each dumb visual to the design tool via quoted skill calls.
