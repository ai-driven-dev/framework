import { builtPlacementOf } from "../../../../src/composition/orchestration/built-placement.js";
import { InstallConfig } from "../../../../src/contexts/installation/application/install/install-config.use-case.js";
import type { BuiltMaterializationDeps } from "../../../../src/contexts/installation/application/plugin/files/built-materialization-deps.js";
import { ApplyPluginFiles } from "../../../../src/contexts/installation/application/restore/apply-plugin-files.use-case.js";
import { GenerateToolDistribution } from "../../../../src/contexts/installation/application/restore/generate-tool-distribution.use-case.js";
import { Restore } from "../../../../src/contexts/installation/application/restore/restore.use-case.js";
import { RestoreAllPlugins } from "../../../../src/contexts/installation/application/restore/restore-all-plugins.use-case.js";
import { RestoreDriftEntries } from "../../../../src/contexts/installation/application/restore/restore-drift-entries.use-case.js";
import { RestoreMergeFiles } from "../../../../src/contexts/installation/application/restore/restore-merge-files.use-case.js";
import { RestoreRegularFiles } from "../../../../src/contexts/installation/application/restore/restore-regular-files.use-case.js";
import { RestoreToolFiles } from "../../../../src/contexts/installation/application/restore/restore-tool-files.use-case.js";
import type { FileMerger } from "../../../../src/contexts/installation/ports/file-merger.js";
import type { ManifestRepository } from "../../../../src/contexts/installation/ports/manifest-repository.js";
import type { Platform } from "../../../../src/contexts/installation/ports/platform.js";
import type { LoadDistribution } from "../../../../src/contexts/installation/ports/plugin/load-plugin-distribution.js";
import type { Prompter } from "../../../../src/orchestration/ports/prompter.js";
import type { AssetProvider } from "../../../../src/shared/ports/asset-provider.js";
import type { FileReader } from "../../../../src/shared/ports/file-reader.js";
import type { FileWriter } from "../../../../src/shared/ports/file-writer.js";
import type { Logger } from "../../../../src/shared/ports/logger.js";
import { InMemoryManifestRepository } from "../../../shared/testing/in-memory-manifest-repository.fake.js";
import { registeredTools } from "../../../shared/testing/registered-tools.builder.js";
import { FakePlatform } from "./fake-platform.fake.js";

type Files = FileReader & FileWriter & FileMerger;

interface RestoreToolFilesParts {
  fs: Files;
  logger: Logger;
  prompter: Prompter;
  platform?: Platform;
  assetProvider?: AssetProvider;
}

/** A restore of one tool's files, built from the same ports. */
export function restoreToolFilesOf(parts: RestoreToolFilesParts): RestoreToolFiles {
  const { fs, logger, prompter } = parts;
  const drift = new RestoreDriftEntries(prompter);
  return new RestoreToolFiles(
    {
      generateToolDistribution: new GenerateToolDistribution(
        new InstallConfig(fs),
        parts.platform ?? new FakePlatform("linux"),
        parts.assetProvider
      ),
      restoreRegularFiles: new RestoreRegularFiles(fs, drift),
      restoreMergeFiles: new RestoreMergeFiles(fs, drift),
      logger,
    },
    registeredTools()
  );
}

interface RestoreAllPluginsParts {
  fs: FileReader & FileWriter;
  loadDistribution: LoadDistribution;
  builtDeps: BuiltMaterializationDeps;
  userManifestRepo?: Pick<ManifestRepository, "load">;
}

/** A restore of every installed plugin, with the registered tools. */
export function restoreAllPluginsOf(parts: RestoreAllPluginsParts): RestoreAllPlugins {
  const { fs, loadDistribution, builtDeps } = parts;
  return new RestoreAllPlugins(
    {
      applyPluginFiles: new ApplyPluginFiles({
        fs,
        loadDistribution,
        ...builtPlacementOf(fs, builtDeps),
      }),
      machineManifest: parts.userManifestRepo ?? new InMemoryManifestRepository(),
    },
    registeredTools()
  );
}

interface RestoreParts extends RestoreToolFilesParts {
  manifestRepo: ManifestRepository;
  plugins: RestoreAllPlugins;
}

/** The project restore, its sub-commands built from the same ports. */
export function restoreOf(parts: RestoreParts): Restore {
  return new Restore(
    {
      fs: parts.fs,
      manifestRepo: parts.manifestRepo,
      restoreToolFiles: restoreToolFilesOf(parts),
      restoreAllPlugins: parts.plugins,
    },
    registeredTools()
  );
}
