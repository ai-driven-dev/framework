import { builtMarketplaceRoot } from "../../../../shared/domain/layout/aidd-layout.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";

export interface RemoveBuiltMarketplaceRequest {
  projectRoot: string;
  name: string;
}

/** Deletes the trees a project-scope marketplace was built into, for every tool. */
export class RemoveBuiltMarketplace {
  constructor(private readonly fs: Pick<FileWriter, "deleteDirectory">) {}

  async execute(command: RemoveBuiltMarketplaceRequest): Promise<void> {
    await this.fs.deleteDirectory(builtMarketplaceRoot(command.projectRoot, command.name));
  }
}
