import type { TrackedFile } from "./tracked-file.js";

export interface DocsEntry {
  readonly version: string;
  readonly files: readonly TrackedFile[];
}
