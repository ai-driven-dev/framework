# Reference: Post-Install Pipeline

## Rule

Any use-case writing framework files AND updating the manifest must delegate to `PostInstallPipelineUseCase`. Never replicate the steps inline.

## Steps (in order)

1. `manifestRepo.save()` — persist updated manifest
2. `GitignoreUseCase.execute()` — update `.gitignore` with tracked framework paths

## How to delegate

```typescript
import { PostInstallPipelineUseCase } from "../shared/post-install-pipeline-use-case.js";

await new PostInstallPipelineUseCase(this.fs, this.manifestRepo).execute({
  projectRoot: options.projectRoot,
  manifest: options.manifest,
});
```

## Forbidden

- Never call `manifestRepo.save()` in isolation outside the pipeline
- Never call `GitignoreUseCase` directly from a feature use-case

## InitUseCase exception

`InitUseCase` calls the pipeline directly (no skipped steps). This is the only documented exception and must be noted inline in the file.
