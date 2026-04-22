import type { ExternalTokenProvider } from "./external-token-provider.js";

export interface ExternalAuthProvider extends ExternalTokenProvider {
  verify(): Promise<string>;
}
