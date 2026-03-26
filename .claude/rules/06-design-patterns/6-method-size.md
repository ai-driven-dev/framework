---
paths:
  - "src/application/use-cases/**/*.ts"
  - "src/domain/**/*.ts"
---

# Method Size Limit

## Hard limit: 20 lines per method

Every method — public or private — must be ≤ 20 lines.

## Counting rule

- Code lines count (statements, expressions, return, closing braces of blocks)
- Blank lines do not count
- Comment-only lines do not count

## Typical violation pattern

Nested `for` loops with conditional blocks inside a single method body:

```ts
// BAD — single method doing too much
private async processDiffs(diffs: FileDiff[]): Promise<void> {
  for (const diff of diffs) {
    if (diff.kind === "changed") {
      const decision = await this.prompter.resolveConflict(diff.path, "modified");
      if (decision === "overwrite") {
        // write ...
        // hash ...
        // manifest update ...
      } else if (decision === "backup") {
        // backup logic ...
      }
    }
  }
}

// GOOD — each concern is a named private method
private async processDiffs(diffs: FileDiff[]): Promise<void> {
  for (const diff of diffs) {
    await this.processSingleDiff(diff);
  }
}

private async processSingleDiff(diff: FileDiff): Promise<void> {
  if (diff.kind !== "changed") return;
  const decision = await this.prompter.resolveConflict(diff.path, "modified");
  await this.applyDecision(diff, decision);
}
```

## Anti-patterns

- `executeInternal()` — sign that `execute()` was split only to work around the limit, not to name a concept
- `handleXxxWithLongBody()` — naming the mechanics, not the intent

## Extraction rule

The extracted method name must describe its **intent**, not its mechanics:

- Bad: `writeThenHash()` (mechanics)
- Good: `applyFrameworkFile()` (intent)
- Bad: `loopOverAddedEntries()` (mechanics)
- Good: `installAddedFiles()` (intent)
