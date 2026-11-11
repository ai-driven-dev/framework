import { chmod, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe } from "vitest";
import { parseMarketplacesWithSource } from "../../../../src/contexts/host-registration/infrastructure/marketplace-list-parsers.js";
import { InstallLocationsByNameReader } from "../../../../src/contexts/host-registration/infrastructure/marketplace-registry-reader.js";
import {
  HostRegistryMarketplaceSourceReaderAdapter,
  NativeMarketplaceSourceReaderAdapter,
} from "../../../../src/contexts/host-registration/infrastructure/marketplace-source-readers.js";
import { FakeHostActions } from "../testing/fake-host-actions.js";
import { FakeHostMarketplaceSources } from "../testing/fake-host-marketplace-sources.js";
import {
  describeHostMarketplaceSourcesContract,
  type MarketplaceSourcesScenario,
  type MarketplaceSourcesSubject,
} from "../testing/host-marketplace-sources-contract.js";
import { scratchDirectory } from "../testing/scratch-directory.js";

describeHostMarketplaceSourcesContract(
  "the fake",
  async (scenario: MarketplaceSourcesScenario): Promise<MarketplaceSourcesSubject> => {
    const host = new FakeHostActions();
    if (scenario.kind === "unreadable") host.addMarketplace("/srv/aidd/unnamed", "project");
    return {
      sources: new FakeHostMarketplaceSources(
        host,
        "registry",
        () => undefined,
        scenario.kind === "holds"
          ? new Map([[scenario.name, { kind: "registry" as const, source: scenario.source }]])
          : new Map()
      ),
      projectRoot: "/srv/project",
      dispose: async () => undefined,
    };
  }
);

describeHostMarketplaceSourcesContract(
  "HostRegistryMarketplaceSourceReaderAdapter over a registry file",
  async (scenario: MarketplaceSourcesScenario): Promise<MarketplaceSourcesSubject> => {
    const scratch = await scratchDirectory();
    const file = join(scratch.dir, "known_marketplaces.json");
    if (scenario.kind === "unreadable") await mkdir(file);
    else
      await writeFile(
        file,
        JSON.stringify(
          scenario.kind === "holds" ? { [scenario.name]: { installLocation: scenario.source } } : {}
        )
      );
    return {
      sources: new HostRegistryMarketplaceSourceReaderAdapter(
        new InstallLocationsByNameReader(file)
      ),
      projectRoot: scratch.dir,
      dispose: scratch.dispose,
    };
  }
);

/** The listing is a script on a `PATH` that holds nothing else. `spawnSync` resolves no `.cmd`
 * and the repository fakes binaries with `#!/bin/sh` only, so Windows runs the other arms. */
describe.skipIf(process.platform === "win32")("on a POSIX machine", () => {
  let previousPath: string | undefined;

  beforeEach(() => {
    previousPath = process.env.PATH;
  });

  afterEach(() => {
    process.env.PATH = previousPath;
  });

  describeHostMarketplaceSourcesContract(
    "NativeMarketplaceSourceReaderAdapter over a stub listing",
    async (scenario: MarketplaceSourcesScenario): Promise<MarketplaceSourcesSubject> => {
      const scratch = await scratchDirectory();
      const listing = JSON.stringify({
        marketplaces:
          scenario.kind === "holds"
            ? [
                {
                  name: scenario.name,
                  root: "/srv/aidd/root",
                  marketplaceSource: { sourceType: "local", source: scenario.source },
                },
              ]
            : [],
      });
      const script =
        scenario.kind === "unreadable"
          ? "#!/bin/sh\necho 'host broke' >&2\nexit 1\n"
          : `#!/bin/sh\necho '${listing}'\n`;
      await writeFile(join(scratch.dir, "probe-host"), script);
      await chmod(join(scratch.dir, "probe-host"), 0o755);
      process.env.PATH = scratch.dir;
      return {
        sources: new NativeMarketplaceSourceReaderAdapter({
          binary: "probe-host",
          args: ["marketplace", "list"],
          parse: (output) => parseMarketplacesWithSource("probe", output),
          unavailableMessage: "probe-host is unavailable",
          unverifiedMessage: "probe-host sources are unverified",
        }),
        projectRoot: scratch.dir,
        dispose: scratch.dispose,
      };
    }
  );
});
