import { CachedTokenProvider } from "../../../../src/contexts/auth/application/cached-token-provider.js";
import { CheckStatus } from "../../../../src/contexts/auth/application/check-status.js";
import { LogIn } from "../../../../src/contexts/auth/application/log-in.js";
import { LogOut } from "../../../../src/contexts/auth/application/log-out.js";
import type { CliAuthProvider } from "../../../../src/contexts/auth/ports/cli-auth-provider.js";
import type { ExternalTokenSource } from "../../../../src/contexts/auth/ports/external-token-source.js";
import type { Logger } from "../../../../src/kernel/ports/logger.js";
import { CapturingLogger } from "../../../helpers/ports/capturing-logger.js";
import { InMemoryEnvironment } from "../../../helpers/ports/in-memory-environment.js";
import { FakeCliAuthProvider } from "./fake-cli-auth-provider.js";
import { FakeIdentityVerifier } from "./fake-identity-verifier.js";
import { InMemoryCredentialRecordRepository } from "./in-memory-credential-record-repository.js";

/** A token provider over neutral doubles: no record, no supplied token, a provider with
 * nothing, a logger that keeps what it is told. */
export function aCachedTokenProvider() {
  let records = new InMemoryCredentialRecordRepository();
  let commandLine: string | undefined;
  let environment = new InMemoryEnvironment();
  let externalTokens: ExternalTokenSource = new FakeCliAuthProvider();
  let logger: Logger = new CapturingLogger();
  const builder = {
    withRecords(value: InMemoryCredentialRecordRepository) {
      records = value;
      return builder;
    },
    withCommandLine(token: string) {
      commandLine = token;
      return builder;
    },
    withEnvironmentToken(token: string) {
      environment = new InMemoryEnvironment({ AIDD_TOKEN: token });
      return builder;
    },
    withExternalTokens(value: ExternalTokenSource) {
      externalTokens = value;
      return builder;
    },
    withLogger(value: Logger) {
      logger = value;
      return builder;
    },
    build(): CachedTokenProvider {
      const supplied = commandLine === undefined ? { environment } : { commandLine, environment };
      return new CachedTokenProvider(records, supplied, externalTokens, logger);
    },
  };
  return builder;
}

/** A login over neutral doubles: no record, a verifier that knows no token, no provider. */
export function aLogIn() {
  let records = new InMemoryCredentialRecordRepository();
  let identity = new FakeIdentityVerifier();
  const cliProviders = new Map<string, CliAuthProvider>();
  const builder = {
    withRecords(value: InMemoryCredentialRecordRepository) {
      records = value;
      return builder;
    },
    withIdentity(value: FakeIdentityVerifier) {
      identity = value;
      return builder;
    },
    withCliProvider(name: string, provider: CliAuthProvider) {
      cliProviders.set(name, provider);
      return builder;
    },
    build(): LogIn {
      return new LogIn(records, identity, cliProviders);
    },
  };
  return builder;
}

/** A logout over a repository holding nothing. */
export function aLogOut() {
  let records = new InMemoryCredentialRecordRepository();
  const builder = {
    withRecords(value: InMemoryCredentialRecordRepository) {
      records = value;
      return builder;
    },
    build(): LogOut {
      return new LogOut(records);
    },
  };
  return builder;
}

/** A status check over neutral doubles: no record, no AIDD_TOKEN, a verifier that knows no
 * token, no provider. */
export function aCheckStatus() {
  let records = new InMemoryCredentialRecordRepository();
  let environment = new InMemoryEnvironment();
  let identity = new FakeIdentityVerifier();
  const cliProviders = new Map<string, CliAuthProvider>();
  const builder = {
    withRecords(value: InMemoryCredentialRecordRepository) {
      records = value;
      return builder;
    },
    withEnvironmentToken(token: string) {
      environment = new InMemoryEnvironment({ AIDD_TOKEN: token });
      return builder;
    },
    withIdentity(value: FakeIdentityVerifier) {
      identity = value;
      return builder;
    },
    withCliProvider(name: string, provider: CliAuthProvider) {
      cliProviders.set(name, provider);
      return builder;
    },
    build(): CheckStatus {
      return new CheckStatus(records, environment, identity, cliProviders);
    },
  };
  return builder;
}
