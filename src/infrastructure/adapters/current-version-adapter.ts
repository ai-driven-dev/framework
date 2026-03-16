import pkg from "../../../package.json" with { type: "json" };
import type { CurrentVersionProvider } from "../../domain/ports/current-version-provider.js";

export class CurrentVersionAdapter implements CurrentVersionProvider {
  get(): string {
    return pkg.version;
  }
}
