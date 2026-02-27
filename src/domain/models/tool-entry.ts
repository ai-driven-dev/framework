import type { ToolId } from "./tool-spec.js";
import type { TrackedFile } from "./tracked-file.js";

export interface ToolEntry {
  readonly toolId: ToolId;
  readonly version: string;
  readonly files: readonly TrackedFile[];
}
