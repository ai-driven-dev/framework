# 01 - Survey

Settle where the project stands before anything is written.

## Input

The user's request.

## Process

1. **Look.** Read `aidd_docs/ui/` and the project's web code: the folders holding components or styles, and any file declaring design tokens, such as CSS custom properties or a theme file.
2. **Classify.** Name the state from what was found.
   - No `aidd_docs/ui/` and no web UI code: blank.
   - No `aidd_docs/ui/`, web UI code: existing code.
   - `aidd_docs/ui/system.md` present: design system. Run `validate` and keep its problems.
   - Only native or non-web UI: stop, saying this design system covers web apps.
   - Web and native together: cover the web part only, and write in `brand.md` Platforms that the native part is out of scope.
   - A blank project: `code-roots` names the folder the UI will live in.
3. **Confirm.** Tell the person in one line what was found and which path follows; ask only when the request and the code disagree.
4. **Route.** Read the next action for the state.
   - Blank or existing code: read [brand](02-brand.md).
   - Design system with T1 or T10 among its problems: read [tokens](04-tokens.md), then route the request below.
   - Design system and a change to a token or an element: read [change](06-change.md).
   - Design system and new elements: read [components](05-components.md).

## Output

The state, `blank`, `existing code` or `design system`, with the code roots found or the change asked for.

## Test

| Case | Pass |
| --- | --- |
| Empty project | state `blank`, the next action is brand |
| Project with components and styles | state `existing code`, the code roots are named |
| Project with `system.md` | state `design system`, its problems are kept |
| Project with `system.md`, no `tokens.json` or a stale `tokens.css` | the next action is tokens |
| Mobile-only app | the run stops and says the design system covers web apps |
| Web and native app | the web part only, the native part named out of scope in `brand.md` Platforms |
