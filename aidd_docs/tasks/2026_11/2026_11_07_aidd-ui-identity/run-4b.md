# Run: aidd-ui 4b, variants and brand

Evidence for slice 4b: one pilot pass, one browser pass, the real save of the feedback, and the mutation of each guard.

## Pilot

On HEAD 22902b837, clean tree. One pass, blank then Kairos. Warnings follow the model's choices and do not count.

```txt
blank errors none warnings V6 wireframes all code untouched steps ok
kairos errors none warnings C3,C4,R18,V6 wireframes all code untouched steps ok
```

Gouvernail was not run: its checkout no longer exists on this machine.

Brand step of the blank pilot, from its trace. `compare brand` exits 0 with three directions:

```json
{
  "variants": [
    { "name": "sea-glass", "intent": "Calm as moving water: a slow rhythm Lea can follow between meetings" },
    { "name": "paper", "intent": "Quiet as a notebook: nothing to decode, nothing to learn before the first breath" },
    { "name": "dawn", "intent": "Warm as first light: encouragement for a first try" }
  ],
  "page": "aidd_docs/ui/drafts/brand/compare.html"
}
```

Then `keep brand sea-glass` exits 0 with `{ "kept": "sea-glass", "written": ["aidd_docs/ui/brand.md"] }`. Only `.gitignore` remains under `drafts/`.

Limit: the pilot request tells the model to compare and keep, so it chose sea-glass itself. No page was handed over and no feedback read. The browser pass and the real save used a separate hand-made set. Each piece is proven; the whole loop with a person is not.

## Browser

`@playwright/cli@0.1.17` over `file://`, with `PLAYWRIGHT_MCP_ALLOW_UNRESTRICTED_FILE_ACCESS=1`. Two pages: three brand variants, and two component variants with states and two themes. Console: no error on either.

| Check | Brand | Component |
| --- | --- | --- |
| Switch variants | pass | pass |
| Two side by side | pass | pass |
| Discard, then undo | pass | pass |
| State | none declared | pass, hidden variant included |
| Theme | none declared | pass, token value changes |
| Rating and comment in the feedback | pass | pass |
| Frame height once shown | pass | pass |

Feedback copied by the brand page, in the format of `help compare`:

```json
{
  "draft": "brand",
  "variants": [
    { "name": "a", "rating": 4, "discarded": false, "comment": "calm" },
    { "name": "b", "rating": 2, "discarded": true, "comment": "too loud" },
    { "name": "c", "rating": 5, "discarded": false, "comment": "dense, good" }
  ]
}
```

The clipboard was not read back: the check saw the value handed to the clipboard.

## Real save

The person clicked Save on the brand page, in Chrome, and picked the set's folder. `drafts/brand/feedback.json` was written, in the same format, nothing rated:

```json
{ "draft": "brand", "variants": [
  { "name": "a", "rating": null, "discarded": false, "comment": "" },
  { "name": "b", "rating": null, "discarded": false, "comment": "" },
  { "name": "c", "rating": null, "discarded": false, "comment": "" }
] }
```

The open question of the spec is closed: the page writes the file under Chromium, after a click, the person choosing the folder. Elsewhere it copies only.

## Mutations

Each guard broken once, its own test red, then restored.

| Guard | Mutation | Red test |
| --- | --- | --- |
| `load` skips `drafts/` | drafts folder dropped from the skip list | validates as before with a draft of an unknown kind |
| D1 | fewer than one variant flagged instead of two | D1 flags a set of one variant |
| D2 | intent check disabled | D2 flags a variant without an intent |
| D3 | axis column check disabled, then empty cell check | D3 flags a table without an axis column, then an empty axis cell |
| D4 | case folding removed | D4 flags two variants with the same axis values |
| D5 | folder check disabled | D5 flags a variant without a folder, then an empty folder |
| D5, row name | type check, then name check removed | D5 flags a table without a Variant column, and a variant named like a path |
| `compare` ignore file | write removed | checks a valid set |
| `compare` drops old feedback | removal skipped | drops the feedback of an earlier page |
| `keep` leaves the preview | preview filter removed | makes the variant the design system's file |
| `keep` deletes the set | removal skipped | makes the variant the design system's file |
| `keep` refuses an invalid set | refusal disabled | refuses a set that has a problem |
| `keep` marks the turn | `keep` dropped from the engine writes | marks the turn when a shell command keeps a variant |
| Set name | name check disabled | refuses a name that leaves the drafts folder |
| Feedback discard flag | field removed | builds the feedback of a rated, discarded and commented state |
| Feedback rating | null default replaced by 0 | the same |
| Tokens in line | link replacement neutralised | takes the tokens of the design system in line |
| Themes without a system | default themes returned | lists no theme without a design system file |
| States sorted | sort removed | lists the states its renders carry |
| Variant order | rows reversed | lists the variants in the order of `variants.md` |
| Save where the browser can | feature test forced true | saves to a file only where the browser can |
| `engine.md` compare row | step number changed | names, for each row, steps of that action which exist |
| Pilot engine files | ignore file dropped | lets each skill's step drive only these engine files |
| Pilot blank request | "three" removed | asks for three directions in the blank brand request |

The page's discard and frame height are browser script, checked in the browser pass, not in node.
