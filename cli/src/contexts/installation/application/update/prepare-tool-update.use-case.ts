import { join } from "node:path";
import type { FileHash } from "../../../../shared/domain/file-hash.js";
import { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { BeforeWriteGate } from "../install/config/tracked-config-files.use-case.js";
import type { ResolveSyncConflict } from "../resolve-sync-conflict.use-case.js";
import type { PreparedUpdate, UpdateToolRequest } from "./update-tool.use-case.js";

/** What PrepareToolUpdate is built from. */
export interface PrepareToolUpdateDeps {
  readonly resolveSyncConflict: Pick<ResolveSyncConflict, "execute">;
  readonly manifestRepo: ManifestRepository;
}

/** Reads what one tool's update runs against. A fault here belongs to no tool: it is the caller's
 * to stop on, not to report beside the tools that did update. */
export class PrepareToolUpdate {
  constructor(private readonly deps: PrepareToolUpdateDeps) {}

  async execute(command: UpdateToolRequest): Promise<PreparedUpdate> {
    const manifest = (await this.deps.manifestRepo.load()) ?? Manifest.create();
    return { command, manifest, guard: this.buildFileGuard(manifest, command) };
  }

  private buildFileGuard(manifest: Manifest, command: UpdateToolRequest): BeforeWriteGate {
    const hashes = new Map<string, FileHash>();
    for (const f of manifest.getToolFiles(command.toolId)) hashes.set(f.relativePath, f.hash);
    return async (relativePath: string) => {
      const isModified = await this.deps.resolveSyncConflict.execute({
        diskPath: join(command.projectRoot, relativePath),
        recorded: hashes.get(relativePath),
      });
      if (!isModified) return "write";
      return (await command.overwriteModified(relativePath)) ? "write" : "skip";
    };
  }
}
