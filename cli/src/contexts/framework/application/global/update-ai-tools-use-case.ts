import type { AiToolId } from "../../../../shared/domain/tool.js";
import { isAiToolId } from "../../../../shared/domain/tool.js";
import type { VersionReader } from "../../../../shared/ports/version-reader.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { UpdateOneToolUseCase } from "./update-one-tool-use-case.js";
import { UpdateToolsUseCase } from "./update-tools-use-case.js";

export class UpdateAiToolsUseCase extends UpdateToolsUseCase<AiToolId> {
  constructor(
    manifestRepo: ManifestRepository,
    versionReader: VersionReader,
    updateOneToolUseCase: UpdateOneToolUseCase
  ) {
    super(manifestRepo, versionReader, updateOneToolUseCase, isAiToolId);
  }
}
