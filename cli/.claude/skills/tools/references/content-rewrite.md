# Reference: Content Rewrite

## Contract

```typescript
rewriteContent(content: string): string;
```

One direction, one argument. A tool profile declares it in `contexts/tools/domain/contracts.ts`
and implements it in `contexts/tools/domain/profiles/<tool>/profile.ts`. It is called on the
install path (`contexts/framework/application/install/content/install-content-section-use-case.ts`)
and on the translate path (`contexts/translate/domain/content-translator.ts`) — every file that reaches a tool's tree
passes through it.

There is no reverse. The round-trip API that used to live here was deleted once nothing
produced input for it: the CLI writes owned files from the canonical source, it never reads a
tool's tree back into canonical form. If you find yourself wanting an inverse, the question to
answer first is what would call it.

There are no base helpers either, and no `docsDir` parameter. `DOCS_DIR` is a constant in
`kernel/paths.ts`; a profile that needs it imports it.

## What a profile actually does

**Nothing, when the tool reads the canonical layout as-is.** `opencode` and `codex` rewrite
paths for their own directory shapes; `claude` rewrites only its numbered command directories:

```typescript
rewriteContent(content: string): string {
  return content.replace(
    /(@?)\.claude\/commands\/(\d+)[_][^/]+\//g,
    (_, at, phase) => `${at}${commandsDir(phase)}`
  );
},
```

**Placeholder resolution, when the tool's host cannot follow the canonical references.**
`copilot` is the one real case: it turns `@{{TOOLS}}/…` and `@{{DOCS}}/…` into markdown links
with a relative href, because Copilot does not resolve `@`-includes. That profile is the
example to read before writing a new one — `profiles/copilot/profile.ts`,
`rewriteCopilotContent`.

Note the two spellings it distinguishes, because a new tool will meet the same choice:
`{{TOOLS}}/` without `@` replaces a directory prefix only (frontmatter, prose); `@{{TOOLS}}/`
resolves to a full installed path.

## The trap this reference exists to name

A profile whose `rewriteContent` is the identity is indistinguishable from a profile that
forgot to implement it — until a placeholder reaches a user's file verbatim. No build
comparison sees it: the byte-frozen golden cell is `claude`, whose rewrite emits no placeholder,
and the marketplace build never calls `rewriteContent`.

So: **prove a rewrite on the install path, with a fixture that contains the placeholder.**
A build comparison cannot see this.

## Test

```typescript
it("points an agent reference at the installed .agent.md file", () => {
  const out = copilot.rewriteContent("See @{{TOOLS}}/agents/executor.md for details");
  expect(out).toContain("(../../.github/agents/executor.agent.md)");
  expect(out).not.toContain("{{TOOLS}}");
});
```

The full case, with the exact rewritten string: `tests/contexts/tools/domain/profiles/copilot/content.unit.test.ts`.
