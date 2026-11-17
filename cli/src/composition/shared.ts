import { WithdrawFromHost } from "../contexts/host-registration/application/withdraw-from-host.js";
import { HasherAdapter } from "../contexts/installation/infrastructure/hasher-adapter.js";
import { JsonFileMergerAdapter } from "../contexts/installation/infrastructure/json-file-merger-adapter.js";
import { ManifestRepositoryAdapter } from "../contexts/installation/infrastructure/manifest-repository-adapter.js";
import { PlatformAdapter } from "../contexts/installation/infrastructure/platform-adapter.js";
import { PluginDistributionReaderAdapter } from "../contexts/installation/infrastructure/plugin-distribution-reader-adapter.js";
import { UserManifestRepositoryAdapter } from "../contexts/installation/infrastructure/user-manifest-repository-adapter.js";
import type { ToolCatalog } from "../contexts/tools/contract/tool-catalog.js";
import { pluginManifestProbes } from "../contexts/translate/domain/plugin-format.js";
import type { FactoryOptions } from "../presentation/deps.js";
import { CLIOutput } from "../presentation/output.js";
import {
  InquirerPrompterAdapter,
  SilentPrompterAdapter,
} from "../presentation/terminal/prompter-adapter.js";
import { atomicWriteFile } from "../shared/infrastructure/atomic-write.js";
import { CurrentVersionAdapter } from "../shared/infrastructure/current-version-adapter.js";
import { EnvironmentAdapter } from "../shared/infrastructure/environment-adapter.js";
import { FileAdapter } from "../shared/infrastructure/file-adapter.js";
import { HttpClient } from "../shared/infrastructure/http-client.js";
import { userConfigDir } from "../shared/infrastructure/user-config-dir.js";
import { wireAuth } from "./auth.js";
import { wireDistribution } from "./distribution.js";
import { wireHostRegistration } from "./host-registration.js";
import { wireMachineClaims } from "./machine-claims.js";

/** The adapters and context wirings every area reads: the file system, the manifests, auth, host
 * registration and distribution. Built once per graph. */
export function wireBase(
  projectRoot: string,
  options: FactoryOptions,
  output: CLIOutput | undefined,
  tools: ToolCatalog
) {
  const hasher = new HasherAdapter();
  const logger = output ?? new CLIOutput(options.verbose);
  const fs = new JsonFileMergerAdapter(new FileAdapter(hasher, logger));
  const pluginDistributionReader = new PluginDistributionReaderAdapter(
    fs,
    pluginManifestProbes(tools)
  );
  const resolveToolId = (raw: string) => tools.toolId(raw);
  const manifestRepo = new ManifestRepositoryAdapter(projectRoot, resolveToolId);
  const userManifestRepo = new UserManifestRepositoryAdapter(
    userConfigDir,
    atomicWriteFile,
    resolveToolId
  );
  const http = new HttpClient();
  const environment = new EnvironmentAdapter();
  const { tokenProvider, logIn, logOut, checkStatus } = wireAuth({
    projectRoot,
    logger,
    http,
    environment,
    explicitToken: options.token,
  });
  const currentVersionProvider = new CurrentVersionAdapter();
  const platform = new PlatformAdapter();
  const prompter = process.stdout.isTTY
    ? new InquirerPrompterAdapter()
    : new SilentPrompterAdapter();
  // Read once, reused wherever a use case needs the scope a plugin is actually registered
  // at: removal, clean, and doctor's own registration check.
  const {
    hostActions: nativePluginActivators,
    marketplaceRegistries: hostMarketplaceRegistries,
    marketplaceSources: nativeSources,
    pluginRegistries: hostPluginRegistries,
  } = wireHostRegistration(tools);
  // Built ahead of every use case that reads a shared-source claim: it depends only on `fs`
  // and `userConfigDir`, neither of which distribution's own wiring produces.
  const { userSourceReferences } = wireMachineClaims(fs);
  const {
    pluginFetcher,
    marketplaceRegistry,
    marketplaceTrustStore,
    releaseResolver,
    resolveMarketplaceUseCase,
    listMarketplaces,
    refreshMarketplace,
    registerFrameworkMarketplace,
  } = wireDistribution({ fs, hasher, http, tokenProvider, logger, projectRoot });
  const withdrawFromHost = new WithdrawFromHost(fs, logger, {
    activators: nativePluginActivators,
    pluginRegistries: hostPluginRegistries,
    marketplaceRegistries: hostMarketplaceRegistries,
    sources: nativeSources,
  });
  return {
    tools,
    projectRoot,
    fs,
    hasher,
    logger,
    http,
    environment,
    tokenProvider,
    currentVersionProvider,
    platform,
    prompter,
    manifestRepo,
    userManifestRepo,
    pluginDistributionReader,
    nativePluginActivators,
    hostMarketplaceRegistries,
    hostPluginRegistries,
    nativeSources,
    userSourceReferences,
    pluginFetcher,
    marketplaceRegistry,
    marketplaceTrustStore,
    releaseResolver,
    resolveMarketplaceUseCase,
    listMarketplaces,
    refreshMarketplace,
    registerFrameworkMarketplace,
    withdrawFromHost,
    logIn,
    logOut,
    checkStatus,
  };
}

export type Base = ReturnType<typeof wireBase>;
