import type { Logger } from "../../../shared/ports/logger.js";
import type { TokenProvider } from "../contract/token-provider.js";
import {
  type CredentialSource,
  firstToken,
  type SuppliedTokens,
  sourcesInOrder,
} from "../domain/credential-sources.js";
import type { CredentialRecordRepository } from "../ports/credential-record-repository.js";
import type { ExternalTokenSource } from "../ports/external-token-source.js";

export interface CachedTokenProviderDeps {
  readonly records: CredentialRecordRepository;
  readonly supplied: SuppliedTokens;
  readonly externalTokens: ExternalTokenSource;
  readonly logger: Logger;
}

/** The token a run carries, found once: the first resolution is kept, a failed one included,
 * so a provider is spawned at most once per run. Says where the token came from, never it. */
export class CachedTokenProvider implements TokenProvider {
  private cached?: Promise<string | null>;

  constructor(private readonly deps: CachedTokenProviderDeps) {}

  resolve(): Promise<string | null> {
    this.cached ??= this.resolveOnce();
    return this.cached;
  }

  private async resolveOnce(): Promise<string | null> {
    const { records, supplied, externalTokens, logger } = this.deps;
    const found = await firstToken(
      sourcesInOrder(supplied, (level) => records.read(level)),
      () => externalTokens.read()
    );
    logger.debug(found === null ? "No token available" : whereFrom(found.source));
    return found?.token ?? null;
  }
}

function whereFrom(source: CredentialSource): string {
  switch (source.kind) {
    case "command-line":
      return "Token given on the command line";
    case "environment":
      return `Token resolved from ${source.variable} env`;
    case "record":
      return `Token resolved from ${source.level} auth.json (${source.record.method})`;
  }
}
