import { CachedTokenProvider } from "../contexts/auth/application/cached-token-provider.js";
import { CheckStatus } from "../contexts/auth/application/check-status.js";
import { LogIn } from "../contexts/auth/application/log-in.js";
import { LogOut } from "../contexts/auth/application/log-out.js";
import type { TokenProvider } from "../contexts/auth/contract/token-provider.js";
import { CredentialRecordFileAdapter } from "../contexts/auth/infrastructure/credential-record-file-adapter.js";
import { GhCliAdapter } from "../contexts/auth/infrastructure/gh-cli-adapter.js";
import type { CliAuthProvider } from "../contexts/auth/ports/cli-auth-provider.js";
import { GitHubAdapter } from "../shared/infrastructure/github-adapter.js";
import { userConfigDir } from "../shared/infrastructure/user-config-dir.js";
import type { Environment } from "../shared/ports/environment.js";
import type { HttpGet } from "../shared/ports/http-get.js";
import type { Logger } from "../shared/ports/logger.js";

export interface AuthWiring {
  projectRoot: string;
  logger: Logger;
  http: HttpGet;
  environment: Environment;
  /** A token the command line carried: composed in, never published to the environment. */
  explicitToken?: string;
}

export interface AuthDeps {
  tokenProvider: TokenProvider;
  logIn: LogIn;
  logOut: LogOut;
  checkStatus: CheckStatus;
}

export function wireAuth(shared: AuthWiring): AuthDeps {
  const records = new CredentialRecordFileAdapter(
    shared.projectRoot,
    userConfigDir,
    () => new Date()
  );
  const gh = new GhCliAdapter();
  const cliProviders = new Map<string, CliAuthProvider>([["gh", gh]]);
  const identity = new GitHubAdapter(shared.http);
  return {
    tokenProvider: new CachedTokenProvider(
      records,
      { commandLine: shared.explicitToken, environment: shared.environment },
      gh,
      shared.logger
    ),
    logIn: new LogIn(records, identity, cliProviders),
    logOut: new LogOut(records),
    checkStatus: new CheckStatus(records, shared.environment, identity, cliProviders),
  };
}
