import { join } from "node:path";
import { Manifest } from "../../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import type { Scope } from "../../../../src/shared/domain/scope.js";
import { initAndInstall } from "../../../shared/testing/installation-deps.builder.js";
import { TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../../../shared/testing/seed-from-directory.builder.js";
import type { FakeMarketplaceRegistry } from "./fake-marketplace-registry.fake.js";
import {
  BUILT_SKILL,
  type Deps,
  GIT_SUBDIR_SOURCE,
  makeRegistry,
  PLUGIN_FIXTURE,
  PLUGIN_METADATA,
} from "./update-built-tree-scenario.builder.js";

/**
 * A cursor plugin the machine installed in its user directory, which the project recorded at
 * project scope, a scope cursor's profile disagrees with. Answers the marketplace placing it
 * reads and the machine's copy of one of its files.
 */
export async function machineOwnedPluginRecordedByProject(
  deps: Deps,
  where: { projectRoot: string; userPluginsDir: string }
): Promise<{ registry: FakeMarketplaceRegistry; machineCopy: string }> {
  const { projectRoot, userPluginsDir } = where;
  await initAndInstall(deps, projectRoot, TOOL.cursor);
  await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
  deps.pluginFetcher.register(GIT_SUBDIR_SOURCE, PLUGIN_FIXTURE);
  deps.fs.setFile(BUILT_SKILL, "# Demo skill");
  const recordedAt = (scope: Scope) =>
    RecordedPlugin.fromMetadata({
      ...PLUGIN_METADATA,
      source: GIT_SUBDIR_SOURCE,
      scope,
      marketplace: "aidd-framework",
    });
  const machine = Manifest.create();
  machine.addTool(TOOL.cursor, "1.0.0", []);
  machine.addPlugin(TOOL.cursor, recordedAt("user"));
  await deps.userManifestRepo.save(machine);
  const project = await deps.manifestRepo.load();
  if (project === null) throw new Error("the project manifest was not initialised");
  project.addPlugin(TOOL.cursor, recordedAt("project"));
  await deps.manifestRepo.save(project);
  const machineCopy = join(userPluginsDir, "sample-plugin/skills/demo/SKILL.md");
  deps.fs.setFile(machineCopy, "machine bytes");
  return { registry: await makeRegistry(), machineCopy };
}
