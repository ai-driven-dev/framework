import type { ExternalTokenSource } from "./external-token-source.js";

export interface CliAuthProvider extends ExternalTokenSource {
  verify(): Promise<string>;
}
