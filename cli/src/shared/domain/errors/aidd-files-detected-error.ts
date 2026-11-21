import { AiddError } from "./aidd-error.js";

export class AiddFilesDetectedError extends AiddError {
  readonly code = "aidd-files-detected";
  constructor() {
    super(
      "AIDD files detected but no manifest found.\nRun `aidd setup` to register existing files."
    );
    this.name = "AiddFilesDetectedError";
  }
}
