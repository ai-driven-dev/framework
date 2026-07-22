# Reference: Content Rewrite

## Contract

`rewriteContent` and `reverseRewriteContent` must form a lossless round-trip:

```
reverseRewriteContent(rewriteContent(content, docsDir), docsDir) === content
```

for every possible `content` string and every `docsDir` value.

## Base helpers

Two base helpers in `domain/formats/placeholders.ts` handle the common cases:

- `baseRewriteContent(content, docsDir)` — replaces `docsDir` occurrences with a canonical placeholder.
- `baseReverseRewriteContent(content, docsDir)` — restores the placeholder back to `docsDir`.

All tools must delegate to these as the foundation layer. Tool-specific transforms are composed
on top.

## Composition order

**rewriteContent**: apply `baseRewriteContent` first, then tool-specific transforms.

**reverseRewriteContent**: apply tool-specific reverse transforms first (in the reverse order
of the forward transforms), then `baseReverseRewriteContent`.

This ordering ensures the base placeholder is always in the correct normalized form for
tool-specific substitutions to operate on.

## When no tool-specific transforms are needed

If the tool only needs the base helpers, delegate entirely and add a comment:

```typescript
rewriteContent(content: string, docsDir: string): string {
  // No tool-specific transforms; delegate to base.
  return baseRewriteContent(content, docsDir);
},
reverseRewriteContent(content: string, docsDir: string): string {
  // No tool-specific transforms; delegate to base.
  return baseReverseRewriteContent(content, docsDir);
},
```

## Agnostic example (fictional `acme` tool with one extra transform)

```typescript
import { baseReverseRewriteContent, baseRewriteContent } from "../../formats/placeholders.js";

const ACME_DOCS_PLACEHOLDER = "[[ACME_DOCS]]";

export const acme: AiTool<...> = {
  // ...
  rewriteContent(content: string, docsDir: string): string {
    const base = baseRewriteContent(content, docsDir);
    return base.replaceAll(docsDir, ACME_DOCS_PLACEHOLDER);
  },
  reverseRewriteContent(content: string, docsDir: string): string {
    const restored = content.replaceAll(ACME_DOCS_PLACEHOLDER, docsDir);
    return baseReverseRewriteContent(restored, docsDir);
  },
};
```

## Round-trip verification

Before marking the action complete, verify manually:

```
const sample = "see [[ACME_DOCS]]/guide.md or /docs/guide.md for details";
const after = acme.rewriteContent(sample, "/docs");
const back = acme.reverseRewriteContent(after, "/docs");
assert(back === sample);
```
