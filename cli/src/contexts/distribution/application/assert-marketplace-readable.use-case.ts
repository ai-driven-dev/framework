import { CatalogFetchAuthError } from "../../../shared/domain/shared.error.js";
import type { TokenProvider } from "../../auth/contract/token-provider.js";
import type { FrameworkSource } from "../contract/framework-source.js";
import { MarketplaceAccess } from "../domain/marketplace-access.js";
import type { RepositoryVisibility } from "../ports/repository-visibility.js";

/** Refuses a remote framework source the credentials at hand cannot read; a local one needs none. */
export class AssertMarketplaceReadable {
  constructor(
    private readonly tokenProvider: TokenProvider,
    private readonly visibility: RepositoryVisibility
  ) {}

  async execute(source: FrameworkSource): Promise<void> {
    if (source.kind !== "github") return;
    const tokenPresent = (await this.tokenProvider.resolve()) !== null;
    // Visibility is asked only without a token: a token reaches either kind.
    const repoPublic = tokenPresent ? false : await this.visibility.isRepoPublic(source.repo);
    if (!new MarketplaceAccess({ tokenPresent, repoPublic }).isReadable()) {
      throw new CatalogFetchAuthError(`https://github.com/${source.repo}`);
    }
  }
}
