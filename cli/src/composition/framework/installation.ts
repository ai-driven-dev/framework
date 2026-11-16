import { homedir } from "node:os";
import { InstallIdeConfig } from "../../contexts/installation/application/install/install-ide-config.js";
import { InstallRuntimeConfig } from "../../contexts/installation/application/install/install-runtime-config.js";
import { RunPostInstallPipeline } from "../../contexts/installation/application/install/run-post-install-pipeline.js";
import { ListInstalledRules } from "../../contexts/installation/application/list-installed-rules.js";
import { ListPlugins } from "../../contexts/installation/application/plugin/list-plugins.js";
import { DetectPluginDrift } from "../../contexts/installation/application/shared/detect-plugin-drift.js";
import {
  EnsureBuiltMarketplace,
  type FrameworkBuildFor,
} from "../../contexts/installation/application/shared/ensure-built-marketplace.js";
import { UpdateGitignore } from "../../contexts/installation/application/update-gitignore.js";
import { BundledAssetProviderAdapter } from "../../contexts/installation/infrastructure/assets/asset-loader.js";
import { TranslatePluginDistribution } from "../../contexts/translate/application/translate-distribution.js";
import { pluginManifestProbes } from "../../contexts/translate/contract/plugin-format.js";
import { userConfigDir } from "../../shared/infrastructure/user-config-dir.js";
import type { Logger } from "../../shared/ports/logger.js";
import { createFrameworkBuildUseCase } from "../translate.js";
import type { Base } from "./base.js";

/** The installation context's shared commands and the build cache they read. */
export function wireInstallation(base: Base) {
  const {
    tools,
    fs,
    hasher,
    logger,
    currentVersionProvider,
    manifestRepo,
    marketplaceRegistry,
    resolveMarketplaceUseCase,
  } = base;
  const assetProvider = new BundledAssetProviderAdapter(tools);
  // `force: true` is safe here: `outDir` is always an aidd-owned disposable cache, never a
  // user-owned directory, so a collision only means a previous build's cache exists. Its
  // diagnostics drop to debug because this build runs behind almost every command, where
  // they would report an implementation detail as news; `--verbose` still shows them.
  const cacheBuildLogger: Logger = {
    debug: (message) => logger.debug(message),
    info: (message) => logger.debug(message),
    warn: (message) => logger.debug(message),
  };
  const frameworkBuildFor: FrameworkBuildFor = (target, mode, outDir) =>
    createFrameworkBuildUseCase(
      tools,
      { fs, assetProvider, logger: cacheBuildLogger },
      { target, mode, outDir, force: true }
    );
  const ensureBuiltMarketplaceUseCase = new EnsureBuiltMarketplace(
    fs,
    resolveMarketplaceUseCase,
    frameworkBuildFor,
    currentVersionProvider,
    userConfigDir
  );
  const detectPluginDriftUseCase = new DetectPluginDrift(fs);
  const updateGitignore = new UpdateGitignore(fs);
  const runPostInstallPipeline = new RunPostInstallPipeline(manifestRepo, updateGitignore);
  const installRuntimeConfigUseCase = new InstallRuntimeConfig(
    fs,
    hasher,
    logger,
    assetProvider,
    runPostInstallPipeline
  );
  const installIdeConfig = new InstallIdeConfig(
    fs,
    hasher,
    logger,
    assetProvider,
    runPostInstallPipeline
  );
  const listInstalledRulesUseCase = new ListInstalledRules(fs);
  const pluginListUseCase = new ListPlugins(manifestRepo);
  // Restore re-materializes through the build pipeline, matching what install wrote:
  // rewriting raw content instead would itself be drift.
  const builtMaterializationDeps = {
    ensureBuilt: ensureBuiltMarketplaceUseCase,
    marketplaceRegistry,
    homedir,
    translate: new TranslatePluginDistribution(pluginManifestProbes(tools)),
  };
  return {
    assetProvider,
    ensureBuiltMarketplaceUseCase,
    updateGitignore,
    runPostInstallPipeline,
    installRuntimeConfigUseCase,
    installIdeConfig,
    listInstalledRulesUseCase,
    pluginListUseCase,
    builtMaterializationDeps,
    detectPluginDriftUseCase,
  };
}

export type Installation = ReturnType<typeof wireInstallation>;
