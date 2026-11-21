import { InstallConfig } from "../../../../src/contexts/installation/application/install/install-config.js";
import { ApplyPluginFiles } from "../../../../src/contexts/installation/application/restore/apply-plugin-files.js";
import { GenerateToolDistribution } from "../../../../src/contexts/installation/application/restore/generate-tool-distribution.js";
import { Restore } from "../../../../src/contexts/installation/application/restore/restore.js";
import { RestoreAllPlugins } from "../../../../src/contexts/installation/application/restore/restore-all-plugins.js";
import { RestoreToolFiles } from "../../../../src/contexts/installation/application/restore/restore-tool-files.js";
import type { BuiltMaterializationDeps } from "../../../../src/contexts/installation/application/shared/built-materialization-deps.js";
import type { FileMerger } from "../../../../src/contexts/installation/ports/file-merger.js";
import type { ManifestRepository } from "../../../../src/contexts/installation/ports/manifest-repository.js";
import type { PluginFetcher } from "../../../../src/contexts/installation/ports/marketplace-sources.js";
import type { Platform } from "../../../../src/contexts/installation/ports/platform.js";
import type { PluginDistributionReader } from "../../../../src/contexts/installation/ports/plugin/plugin-distribution-reader.js";
import type { AssetProvider } from "../../../../src/shared/ports/asset-provider.js";
import type { FileReader } from "../../../../src/shared/ports/file-reader.js";
import type { FileWriter } from "../../../../src/shared/ports/file-writer.js";
import type { Logger } from "../../../../src/shared/ports/logger.js";
import type { Prompter } from "../../../../src/shared/ports/prompter.js";
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
  return new RestoreToolFiles(
    {
      generateToolDistribution: new GenerateToolDistribution(
        new InstallConfig(fs),
        parts.platform ?? new FakePlatform("linux"),
        parts.assetProvider
      ),
      fs,
      prompter,
      logger,
    },
    registeredTools()
  );
}

interface RestoreAllPluginsParts {
  fs: FileReader & FileWriter;
  pluginFetcher: PluginFetcher;
  pluginDistributionReader: PluginDistributionReader;
  builtDeps: BuiltMaterializationDeps;
}

/** A restore of every installed plugin, with the registered tools. */
export function restoreAllPluginsOf(parts: RestoreAllPluginsParts): RestoreAllPlugins {
  const { fs, pluginFetcher, pluginDistributionReader, builtDeps } = parts;
  return new RestoreAllPlugins(
    new ApplyPluginFiles({ fs, pluginFetcher, pluginDistributionReader, builtDeps }),
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
