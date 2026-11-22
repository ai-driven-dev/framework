import type { InspectHostRegistrationRequest } from "../../contract/inspect-host-registration-request.js";
import type { InspectHostRegistrationResult } from "../../contract/inspect-host-registration-result.js";
import type { InspectHostMarketplaceSources } from "./inspect-host-marketplace-sources.use-case.js";
import type { InspectHostPlugins } from "./inspect-host-plugins.use-case.js";

/**
 * Asks each host's own registries whether they carry what aidd asked them to register, and
 * whether a marketplace they already hold points somewhere other than this project's build.
 */
export class InspectHostRegistration {
  constructor(
    private readonly plugins: InspectHostPlugins,
    private readonly sources: InspectHostMarketplaceSources
  ) {}

  async execute(command: InspectHostRegistrationRequest): Promise<InspectHostRegistrationResult> {
    return {
      findings: [
        ...(await this.plugins.execute(command)),
        ...(await this.sources.execute(command)),
      ],
    };
  }
}
