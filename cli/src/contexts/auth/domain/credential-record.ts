import { AuthenticationError } from "../../../shared/domain/errors.js";
import type { AuthLevel, AuthMethod, Credential } from "../contract/credential.js";

/** The document one level keeps: what `auth.json` holds, once read and accepted. */
export interface CredentialRecord {
  version: 1;
  method: AuthMethod;
  level: AuthLevel;
  token?: string;
  provider?: string;
  createdAt: string;
}

/** What a person still has to do once a record is removed: an external provider keeps its
 * own session, which only its own logout ends. */
export type RemovalHint = "external-provider-cleanup";

/** The one place the order of levels is written: the project's record before the user's. */
export const LEVELS_BY_PRECEDENCE: readonly AuthLevel[] = ["project", "user"];

/** The provider of a record written before records named one. */
const DEFAULT_PROVIDER = "gh";

/** A value is a record only with every invariant held; anything else reads as no record, so a
 * hand-written or foreign file authenticates nobody. */
export function parseCredentialRecord(value: unknown): CredentialRecord | null {
  return holdsTheInvariants(value) ? value : null;
}

function holdsTheInvariants(value: unknown): value is CredentialRecord {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === 1 &&
    (candidate.method === "external" || candidate.method === "stored") &&
    (candidate.level === "user" || candidate.level === "project") &&
    typeof candidate.createdAt === "string"
  );
}

/** The record a credential becomes at a level; the key order is the order the file shows. */
export function recordCredential(
  credential: Credential,
  level: AuthLevel,
  createdAt: Date
): CredentialRecord {
  return {
    version: 1,
    method: credential.method,
    level,
    createdAt: createdAt.toISOString(),
    ...(credential.method === "stored"
      ? { token: credential.token }
      : { provider: credential.provider }),
  };
}

export function removalHint(record: Pick<CredentialRecord, "method">): RemovalHint | undefined {
  return record.method === "external" ? "external-provider-cleanup" : undefined;
}

export function providerOf(record: Pick<CredentialRecord, "provider">): string {
  return record.provider ?? DEFAULT_PROVIDER;
}

/** The provider a credential names, among those registered; one nobody registered is
 * refused by name, so the spelling can be fixed. */
export function providerNamed<Provider>(
  providers: ReadonlyMap<string, Provider>,
  name: string
): Provider {
  const provider = providers.get(name);
  if (provider === undefined) throw new AuthenticationError(`unknown external provider: ${name}`);
  return provider;
}

/** A stored record that carries no token is broken, not empty: it is refused, never skipped. */
export function storedTokenOf(record: Pick<CredentialRecord, "token">): string {
  if (!record.token) throw new AuthenticationError("invalid config");
  return record.token;
}
