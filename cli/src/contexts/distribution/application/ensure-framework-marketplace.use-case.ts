import type { EnsuredFrameworkMarketplace, FrameworkSource } from "../contract/framework-source.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../contract/marketplace.js";
import type { AssertMarketplaceReadable } from "./assert-marketplace-readable.use-case.js";
import type { RegisterFrameworkMarketplace } from "./register-framework-marketplace.use-case.js";

export interface EnsureFrameworkMarketplaceRequest {
  projectRoot: string;
  source: FrameworkSource;
}

/** Registers the framework marketplace from a chosen source, once a remote one is known to be
 * reachable with the credentials at hand. */
export class EnsureFrameworkMarketplace {
  constructor(
    private readonly register: Pick<RegisterFrameworkMarketplace, "execute">,
    private readonly assertReadable: Pick<AssertMarketplaceReadable, "execute">
  ) {}

  async execute(command: EnsureFrameworkMarketplaceRequest): Promise<EnsuredFrameworkMarketplace> {
    await this.assertReadable.execute(command.source);
    const result = await this.register.execute({
      projectRoot: command.projectRoot,
      pluginSource: command.source,
      force: true,
    });
    return { name: FRAMEWORK_MARKETPLACE_NAME, scope: result.scope };
  }
}
