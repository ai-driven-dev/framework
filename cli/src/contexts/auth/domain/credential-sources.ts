import type { Environment } from "../../../shared/ports/environment.js";
import type { AuthLevel } from "../contract/credential.js";
import { type CredentialRecord, LEVELS_BY_PRECEDENCE } from "./credential-record.js";

/** The variable that hands a token for a run without storing one. */
export const TOKEN_VARIABLE = "AIDD_TOKEN";

/** The tokens a run was handed rather than read from a record. */
export interface SuppliedTokens {
  /** A token the command line carried: composed in, never published to the environment. */
  readonly commandLine?: string;
  readonly environment: Environment;
}

type CommandLineSource = { readonly kind: "command-line"; readonly token: string };
type EnvironmentSource = {
  readonly kind: "environment";
  readonly variable: typeof TOKEN_VARIABLE;
  readonly token: string;
};
type RecordSource = {
  readonly kind: "record";
  readonly level: AuthLevel;
  readonly record: CredentialRecord;
};

/** One place a credential can come from; a place holding nothing is never a source. */
export type CredentialSource = CommandLineSource | EnvironmentSource | RecordSource;

/** The credential `auth status` reports and verifies: a record's own level and method,
 * or the stored user credential `AIDD_TOKEN` stands for. */
export type ActiveCredential = Pick<CredentialRecord, "level" | "method" | "token" | "provider">;

/** Every source in the one order there is. A record is read only when the sources before
 * it were passed over, so a run that stops early never touches the next level. */
export async function* sourcesInOrder(
  supplied: SuppliedTokens,
  readRecord: (level: AuthLevel) => Promise<CredentialRecord | null>
): AsyncGenerator<CredentialSource> {
  if (supplied.commandLine) yield { kind: "command-line", token: supplied.commandLine };
  const fromEnvironment = supplied.environment.get(TOKEN_VARIABLE);
  if (fromEnvironment)
    yield { kind: "environment", variable: TOKEN_VARIABLE, token: fromEnvironment };
  for (const level of LEVELS_BY_PRECEDENCE) {
    const record = await readRecord(level);
    if (record !== null) yield { kind: "record", level, record };
  }
}

/** The token rule: the first source that yields a token wins, and a record that yields
 * none is passed over. The provider is asked only for an external record. */
export async function firstToken(
  sources: AsyncIterable<CredentialSource>,
  readExternal: () => string | null
): Promise<{ token: string; source: CredentialSource } | null> {
  for await (const source of sources) {
    const token = tokenFrom(source, readExternal);
    if (token !== null) return { token, source };
  }
  return null;
}

/** The status rule: the first source that holds a credential wins, whether or not it would
 * yield a token, so a tokenless project record hides the user's. */
export async function activeCredential(
  sources: AsyncIterable<CredentialSource>
): Promise<ActiveCredential | null> {
  for await (const source of sources) {
    if (holdsRecord(source)) return activeCredentialOf(source);
  }
  return null;
}

function tokenFrom(source: CredentialSource, readExternal: () => string | null): string | null {
  if (source.kind !== "record") return source.token;
  if (source.record.method === "external") return readExternal() || null;
  return source.record.token || null;
}

/** A command-line token serves one run and is never held. */
function holdsRecord(source: CredentialSource): source is EnvironmentSource | RecordSource {
  return source.kind !== "command-line";
}

function activeCredentialOf(source: EnvironmentSource | RecordSource): ActiveCredential {
  if (source.kind === "environment") {
    return { method: "stored", level: "user", token: source.token };
  }
  return source.record;
}
