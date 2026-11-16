import type { TokenProvider } from "../../src/contexts/auth/contract/token-provider.js";
import { EnsureFrameworkMarketplace } from "../../src/contexts/distribution/application/ensure-framework-marketplace.js";
import type { RefreshMarketplace } from "../../src/contexts/distribution/application/refresh-marketplace.js";
import type { RegisterFrameworkMarketplace } from "../../src/contexts/distribution/application/register-framework-marketplace.js";
import type { RepositoryVisibility } from "../../src/contexts/distribution/ports/repository-visibility.js";
import { SetupMarketplaceRegistrationUseCase } from "../../src/contexts/framework/application/shared/setup-marketplace-registration-use-case.js";
import { RecordSourceReference } from "../../src/contexts/machine-claims/application/record-source-reference.js";
import type { UserSourceReferences } from "../../src/contexts/machine-claims/ports/user-source-references.js";
import type { AskMarketplaceSource } from "../../src/orchestration/setup/ask-marketplace-source.js";
import { RegisterMarketplace } from "../../src/orchestration/setup/register-marketplace.js";
import type { Environment } from "../../src/shared/ports/environment.js";
import type { FileReader } from "../../src/shared/ports/file-reader.js";
import type { Logger } from "../../src/shared/ports/logger.js";
import type { VersionReader } from "../../src/shared/ports/version-reader.js";

/** The setup marketplace registration as composition wires it. */
export function setupMarketplaceRegistrar(
  fs: FileReader,
  source: Pick<AskMarketplaceSource, "execute">,
  register: Pick<RegisterFrameworkMarketplace, "execute">,
  refresh: Pick<RefreshMarketplace, "execute">,
  currentVersionProvider: VersionReader,
  logger: Logger,
  environment: Environment,
  tokenProvider?: TokenProvider,
  releaseResolver?: RepositoryVisibility,
  userSourceReferences?: UserSourceReferences
): SetupMarketplaceRegistrationUseCase {
  const registration = new RegisterMarketplace(
    new EnsureFrameworkMarketplace(register, tokenProvider, releaseResolver),
    new RecordSourceReference(fs, currentVersionProvider, logger, userSourceReferences),
    refresh,
    environment
  );
  return new SetupMarketplaceRegistrationUseCase(
    (options) => source.execute(options),
    (flow, chosen) =>
      registration.execute({ projectRoot: flow.projectRoot, scope: flow.scope, source: chosen })
  );
}
