import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  EnabledPluginsMapReader,
  PluginEntriesByScopeReader,
  TomlPluginTablesReader,
} from "../../../../src/contexts/host-registration/infrastructure/plugin-registry-readers.js";
import { FakeHostPluginRegistry } from "../testing/fake-host-plugin-registry.js";
import {
  describeHostPluginRegistryContract,
  type PluginRegistryScenario,
  type PluginRegistrySubject,
} from "../testing/host-plugin-registry-contract.js";
import { scratchDirectory } from "../testing/scratch-directory.js";

describeHostPluginRegistryContract(
  "the fake",
  async (scenario: PluginRegistryScenario): Promise<PluginRegistrySubject> => ({
    registry: new FakeHostPluginRegistry(
      scenario.kind === "holds"
        ? { location: "fake", refs: new Map([[scenario.ref, { enabled: scenario.enabled }]]) }
        : scenario.kind === "holds-nothing"
          ? { location: "fake", refs: new Map() }
          : scenario.kind === "absent"
            ? { location: "fake", absent: true }
            : { location: "fake", unreadable: "the registry could not be read" }
    ),
    projectRoot: "/srv/project",
    dispose: async () => undefined,
  })
);

function onDisk(
  make: (file: string) => PluginRegistrySubject["registry"],
  content: (scenario: PluginRegistryScenario) => string
): (scenario: PluginRegistryScenario) => Promise<PluginRegistrySubject> {
  return async (scenario) => {
    const scratch = await scratchDirectory();
    const file = join(scratch.dir, "registry");
    if (scenario.kind === "unreadable") await mkdir(file);
    else if (scenario.kind !== "absent") await writeFile(file, content(scenario));
    return { registry: make(file), projectRoot: scratch.dir, dispose: scratch.dispose };
  };
}

describeHostPluginRegistryContract(
  "EnabledPluginsMapReader over a settings file",
  onDisk(
    (file) => new EnabledPluginsMapReader(file),
    (scenario) =>
      JSON.stringify({
        enabledPlugins: scenario.kind === "holds" ? { [scenario.ref]: scenario.enabled } : {},
      })
  )
);

describeHostPluginRegistryContract(
  "TomlPluginTablesReader over a TOML file",
  onDisk(
    (file) => new TomlPluginTablesReader(file),
    (scenario) =>
      scenario.kind === "holds"
        ? `[plugins."${scenario.ref}"]\nenabled = ${scenario.enabled}\n`
        : ""
  )
);

describeHostPluginRegistryContract(
  "PluginEntriesByScopeReader over a JSON file",
  onDisk(
    (file) => new PluginEntriesByScopeReader(file),
    (scenario) =>
      JSON.stringify({
        version: 2,
        plugins: scenario.kind === "holds" ? { [scenario.ref]: [{ scope: "user" }] } : {},
      })
  ),
  { recordsDisabled: false }
);
