import { lenientSourceReferences } from "../../../src/composition/contexts/machine-claims.js";
import type { TokenProvider } from "../../../src/contexts/auth/contract/token-provider.js";
import { AssertMarketplaceReadable } from "../../../src/contexts/distribution/application/assert-marketplace-readable.use-case.js";
import { EnsureFrameworkMarketplace } from "../../../src/contexts/distribution/application/ensure-framework-marketplace.use-case.js";
import type { RegisterFrameworkMarketplace } from "../../../src/contexts/distribution/application/register-framework-marketplace.use-case.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import type { RepositoryVisibility } from "../../../src/contexts/distribution/ports/repository-visibility.js";
import { RecordSourceReference } from "../../../src/contexts/machine-claims/application/shared-source/record-source-reference.use-case.js";
import { ResolveReferenceRoot } from "../../../src/contexts/machine-claims/application/shared-source/resolve-reference-root.use-case.js";
import type { UserSourceReferences } from "../../../src/contexts/machine-claims/ports/user-source-references.js";
import type { RefreshMarketplaces } from "../../../src/orchestration/marketplace/refresh-marketplaces.use-case.js";
import { RegisterMarketplace } from "../../../src/orchestration/marketplace/register-marketplace.use-case.js";
import type { AskMarketplaceSource } from "../../../src/orchestration/setup/ask-marketplace-source.use-case.js";
import { ResolveSetupSource } from "../../../src/orchestration/setup/resolve-setup-source.use-case.js";
import type { RegisterFrameworkSource } from "../../../src/orchestration/setup/setup-flow.js";
import type { Environment } from "../../../src/shared/ports/environment.js";
import type { FileReader } from "../../../src/shared/ports/file-reader.js";
import type { Logger } from "../../../src/shared/ports/logger.js";

/** The setup marketplace registration as composition wires it. */
export function setupMarketplaceRegistrar(
  fs: FileReader,
  source: Pick<AskMarketplaceSource, "execute">,
  register: Pick<RegisterFrameworkMarketplace, "execute">,
  refresh: Pick<RefreshMarketplaces, "execute">,
  currentVersion: string,
  logger: Logger,
  environment: Environment,
  tokenProvider: TokenProvider = { resolve: async () => "token" },
  releaseResolver: RepositoryVisibility = { isRepoPublic: async () => true },
  userSourceReferences?: UserSourceReferences
): { resolveSource: ResolveSetupSource; register: RegisterFrameworkSource } {
  const registration = new RegisterMarketplace({
    ensure: new EnsureFrameworkMarketplace(
      register,
      new AssertMarketplaceReadable(tokenProvider, releaseResolver)
    ),
    recordReference: new RecordSourceReference({
      resolveReferenceRoot: new ResolveReferenceRoot(fs),
      currentVersion,
      frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
      userSourceReferences: lenientSourceReferences(userSourceReferences, logger),
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
