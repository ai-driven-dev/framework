import type { ToolId } from "./tool-id.js";
import type { TrackedFile } from "./tracked-file.js";

export interface ToolEntry {
  readonly toolId: ToolId;
  readonly version: string;
  readonly files: readonly TrackedFile[];
}
