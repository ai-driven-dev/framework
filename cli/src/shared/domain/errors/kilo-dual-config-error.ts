import { AiddError } from "./aidd-error.js";

export class KiloDualConfigError extends AiddError {
  readonly code = "kilo-dual-config";
  constructor() {
    super("Both Kilo JSON and JSONC config variants exist at the same location. Remove one.");
    this.name = "KiloDualConfigError";
  }
}
