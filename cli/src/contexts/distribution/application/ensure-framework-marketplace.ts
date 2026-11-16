import { CatalogFetchAuthError } from "../../../shared/domain/errors.js";
import type { TokenProvider } from "../../auth/contract/token-provider.js";
import type { EnsuredFrameworkMarketplace, FrameworkSource } from "../contract/framework-source.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../contract/marketplace.js";
import type { RepositoryVisibility } from "../ports/repository-visibility.js";
import type { RegisterFrameworkMarketplace } from "./register-framework-marketplace.js";

export interface EnsureFrameworkMarketplaceCommand {
  projectRoot: string;
  source: FrameworkSource;
}

/** Registers the framework marketplace from a chosen source, once a remote one is known to be
 * reachable with the credentials at hand. */
export class EnsureFrameworkMarketplace {
  constructor(
    private readonly register: Pick<RegisterFrameworkMarketplace, "execute">,
    private readonly tokenProvider?: TokenProvider,
    private readonly releaseResolver?: RepositoryVisibility
  ) {}

  async execute(command: EnsureFrameworkMarketplaceCommand): Promise<EnsuredFrameworkMarketplace> {
    await this.guardRemoteAuth(command.source);
    const result = await this.register.execute({
      projectRoot: command.projectRoot,
      pluginSource: command.source,
      force: true,
    });
    return { name: FRAMEWORK_MARKETPLACE_NAME, scope: result.scope };
  }

  // Auth is only required to fetch a PRIVATE framework. A token can reach either;
  // without one, allow public repos through and gate only private/unreachable ones.
  private async guardRemoteAuth(source: FrameworkSource): Promise<void> {
    if (source.kind !== "github") return;
    if (this.tokenProvider === undefined) return;
    const token = await this.tokenProvider.resolve();
    if (token !== null) return;
    if (
      this.releaseResolver !== undefined &&
      (await this.releaseResolver.isRepoPublic(source.repo))
    ) {
      return;
    }
    throw new CatalogFetchAuthError(`https://github.com/${source.repo}`);
  }
}
