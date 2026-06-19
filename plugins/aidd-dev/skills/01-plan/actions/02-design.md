# 02 - Design

Describe a frontend page's design before code, its components and their behavior, the dumb/smart split, and the render decision, then write the **delegation prompt** that tells the implementer how to build it.

This action describes and delegates. It writes no code, and running under the `planner` it does **not** spawn the implementer. The implementation side launches it with the prompt written here.

The visual delegation is optional and degrades gracefully. When a UI-craft skill (`impeccable`) is installed, the prompt delegates each dumb visual to it. When none is, the prompt authors the dumb visuals inline from the design tokens. The action's core, the page description and the dumb/smart split, never depends on it.

## Input

The page or feature to design (free text). Nothing else.

## Output

The page, **described**: what it is, its components and their behavior, the dumb/smart split. Plus a bullet list (or small table) of the elements covered, and the delegation prompt for the implementer.

## Process

1. **Describe the page.** Purpose, sections, components. Per component, its behavior (states and transitions), the SMART layer, owned in-house.
2. **Dumb/smart split.** Mark the **presentational (dumb)** components, props in, UI out, no data, logic, routing, or state. Their visual is delegated to the design tool, and its `shape` defines the visual behaviors (one line, not re-specified here).
3. **Render decision.** Ask the user once: see the page rendered, or not?
4. **Write the delegation prompt** for the implementer. It must:
   - Keep the smart layer (data, state, routing, wiring) in your own code. For the dumb visual, when a UI-craft skill is installed, delegate with quotes, never `craft` (that builds the feature): `Use skill "impeccable" with "shape <page/component> - dumb/presentational, props only, tokens from DESIGN.md"`. When none is installed, author the dumb visual inline from the design tokens.
   - **If render was requested, go visual-first.** Craft the page's visual **end-to-end first**, then **verify it in-browser before any wiring**: `Use skill "impeccable" with "live"` to iterate variants until visually good, with `Use skill "impeccable" with "critique <page>"` as the gate. Run under `/goal` (`aidd-dev:09-for-sure`), looping until **zero P0**, then explicit user OK. Only then **attach the verified visual to the code** by wiring the smart layer onto it.
   - **If not.** Author the dumb visuals inline and wire as you go, no `live`, no loop.
5. **Present** the description, the element list, and the delegation prompt. Wait for an explicit OK before exiting.

## Test

- The page is described with its components and their behavior.
- The dumb components are marked.
- The render decision is recorded.
- A delegation prompt exists that builds the smart layer in-house and delegates each dumb visual to the design tool via quoted skill calls.
