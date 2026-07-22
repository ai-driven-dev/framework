# Reference: Manifest Aggregate Root

## Role

- Tracks every installed framework file with its MD5 hash
- Persisted at `.aidd/manifest.json`
- Single source of truth for installed state

## Write guard (applies to any aggregate writing files)

- Before writing any framework file: check `fs.fileExists(path)` AND `!manifest.isFileTracked(relativePath)`
- If both true → skip write, emit `logger.warn()`, never add to manifest
- Never overwrite a user-owned file

## Saving

- Always save via `PostInstallPipelineUseCase`
- Exception: `InitUseCase` may call the pipeline directly (documented inline)
- Never call `manifestRepo.save()` in isolation outside the pipeline

## Merge file tracking

- Merge config files tracked in `ToolEntry.mergeFiles` (not in `files`)
- `isFileTracked()` checks both `files` and `mergeFiles`
- Uninstall/clean must delete merge files alongside regular files

## Agnostic shape example

```typescript
export class InventoryAggregate {
  private readonly entries: Map<string, InventoryEntry>;
  readonly version: number;

  constructor(params: { entries: InventoryEntry[]; version: number }) {
    this.entries = new Map(params.entries.map((e) => [e.id, e]));
    this.version = params.version;
  }

  isTracked(id: string): boolean {
    return this.entries.has(id);
  }

  track(entry: InventoryEntry): InventoryAggregate {
    const updated = [...this.entries.values(), entry];
    return new InventoryAggregate({ entries: updated, version: this.version });
  }
}
```
