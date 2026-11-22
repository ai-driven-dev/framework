import type { TokenProvider } from "../../../src/contexts/auth/contract/token-provider.js";
import { EnsureFrameworkMarketplace } from "../../../src/contexts/distribution/application/ensure-framework-marketplace.use-case.js";
import type { RefreshMarketplace } from "../../../src/contexts/distribution/application/refresh-marketplace.use-case.js";
import type { RegisterFrameworkMarketplace } from "../../../src/contexts/distribution/application/register-framework-marketplace.use-case.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import type { RepositoryVisibility } from "../../../src/contexts/distribution/ports/repository-visibility.js";
import { RecordSourceReference } from "../../../src/contexts/machine-claims/application/record-source-reference.use-case.js";
import type { UserSourceReferences } from "../../../src/contexts/machine-claims/ports/user-source-references.js";
import { RegisterMarketplace } from "../../../src/orchestration/marketplace/register-marketplace.use-case.js";
import type { AskMarketplaceSource } from "../../../src/orchestration/setup/ask-marketplace-source.use-case.js";
import { ResolveSetupSource } from "../../../src/orchestration/setup/resolve-setup-source.use-case.js";
import type { RegisterFrameworkSource } from "../../../src/orchestration/setup/setup-flow.js";
import type { Environment } from "../../../src/shared/ports/environment.js";
import type { FileReader } from "../../../src/shared/ports/file-reader.js";
import type { Logger } from "../../../src/shared/ports/logger.js";
import type { VersionReader } from "../../../src/shared/ports/version-reader.js";

/** The setup marketplace registration as composition wires it. */
export function setupMarketplaceRegistrar(
  fs: FileReader,
  source: Pick<AskMarketplaceSource, "execute">,
  register: Pick<RegisterFrameworkMarketplace, "execute">,
  refresh: Pick<RefreshMarketplace, "execute">,
  currentVersionProvider: VersionReader,
  logger: Logger,
  environment: Environment,
  tokenProvider: TokenProvider = { resolve: async () => "token" },
  releaseResolver: RepositoryVisibility = { isRepoPublic: async () => true },
  userSourceReferences?: UserSourceReferences
): { resolveSource: ResolveSetupSource; register: RegisterFrameworkSource } {
  const registration = new RegisterMarketplace({
    ensure: new EnsureFrameworkMarketplace(register, tokenProvider, releaseResolver),
    recordReference: new RecordSourceReference({
      fs,
      currentVersionProvider,
      logger,
      frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
      userSourceReferences,
    }),
    refresh,
    environment,
  });
  return {
    resolveSource: new ResolveSetupSource((options) => source.execute(options)),
    register: (flow, chosen) =>
      registration.execute({ projectRoot: flow.projectRoot, scope: flow.scope, source: chosen }),
  };
}
