import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { InstallLocationsByNameReader } from "../../../../src/contexts/host-registration/infrastructure/marketplace-registry-reader.js";
import { FakeHostMarketplaceRegistry } from "../testing/fake-host-marketplace-registry.js";
import {
  describeHostMarketplaceRegistryContract,
  type MarketplaceRegistryScenario,
  type MarketplaceRegistrySubject,
} from "../testing/host-marketplace-registry-contract.js";
import { scratchDirectory } from "../testing/scratch-directory.js";

describeHostMarketplaceRegistryContract(
  "the fake",
  async (scenario: MarketplaceRegistryScenario): Promise<MarketplaceRegistrySubject> => ({
    registry: new FakeHostMarketplaceRegistry(
      scenario.kind === "holds"
        ? { location: "fake", entries: new Map([[scenario.name, scenario.source]]) }
        : scenario.kind === "empty"
          ? { location: "fake", entries: new Map() }
          : scenario.kind === "absent"
            ? { location: "fake", absent: true }
            : { location: "fake", unreadable: "the registry could not be read" }
    ),
    dispose: async () => undefined,
  })
);

describeHostMarketplaceRegistryContract(
  "InstallLocationsByNameReader over a registry file",
  async (scenario: MarketplaceRegistryScenario): Promise<MarketplaceRegistrySubject> => {
    const scratch = await scratchDirectory();
    const file = join(scratch.dir, "known_marketplaces.json");
    if (scenario.kind === "unreadable") await mkdir(file);
    else if (scenario.kind !== "absent")
      await writeFile(
        file,
        JSON.stringify(
          scenario.kind === "holds" ? { [scenario.name]: { installLocation: scenario.source } } : {}
        )
      );
    return { registry: new InstallLocationsByNameReader(file), dispose: scratch.dispose };
  }
);
