import { WithdrawFromHost } from "../contexts/host-registration/application/withdraw/withdraw-from-host.js";
import { JsonFileMergerAdapter } from "../contexts/installation/infrastructure/json-file-merger-adapter.js";
import { ManifestRepositoryAdapter } from "../contexts/installation/infrastructure/manifest-repository-adapter.js";
import { PlatformAdapter } from "../contexts/installation/infrastructure/platform-adapter.js";
import { PluginDistributionReaderAdapter } from "../contexts/installation/infrastructure/plugin-distribution-reader-adapter.js";
import { UserManifestRepositoryAdapter } from "../contexts/installation/infrastructure/user-manifest-repository-adapter.js";
import type { ToolCatalog } from "../contexts/tools/contract/tool-catalog.js";
import { pluginManifestProbes } from "../contexts/translate/domain/plugin-format.js";
import type { FactoryOptions } from "../orchestration/deps.js";
import type { Output } from "../orchestration/domain/output.js";
import { InquirerPrompterAdapter } from "../presentation/terminal/inquirer-prompter.adapter.js";
import { OutputAdapter } from "../presentation/terminal/output.adapter.js";
import { SilentPrompterAdapter } from "../presentation/terminal/silent-prompter.adapter.js";
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

/** The version of the running binary, for the entry point that may not import infrastructure. */
export function currentVersion(): string {
  return new CurrentVersionAdapter().get();
}

/** The output of a run: it writes to the terminal and ends the process. `words` says a caught
 * value a log line carries; the entry point hands in the catalogue's, `String` reads only a plain one. */
export function createOutput(verbose: boolean, words: (cause: unknown) => string = String): Output {
  return new OutputAdapter(verbose, (code) => process.exit(code), words);
}

/** What a container is built from: where it runs, how it logs and the catalog its wiring reads. */
export interface BaseOptions extends FactoryOptions {
  projectRoot: string;
  output?: Output;
  tools: ToolCatalog;
}

/** Asks a person when a terminal is attached, and answers its defaults when none is. */
function terminalPrompter() {
  return process.stdout.isTTY ? new InquirerPrompterAdapter() : new SilentPrompterAdapter();
}

/** What each host registers a plugin through, read once and reused wherever a use case needs the
 * scope a plugin is actually registered at: removal, clean, and doctor's own registration check. */
function wireHost(parts: { tools: ToolCatalog; fs: JsonFileMergerAdapter; logger: Output }) {
  const { tools, fs, logger } = parts;
  const {
    hostActions: nativePluginActivators,
    marketplaceRegistries: hostMarketplaceRegistries,
    marketplaceSources: nativeSources,
    pluginRegistries: hostPluginRegistries,
  } = wireHostRegistration(tools);
  const withdrawFromHost = new WithdrawFromHost(fs, logger, {
    activators: nativePluginActivators,
    pluginRegistries: hostPluginRegistries,
    marketplaceRegistries: hostMarketplaceRegistries,
    sources: nativeSources,
  });
  return {
    nativePluginActivators,
    hostMarketplaceRegistries,
    hostPluginRegistries,
    nativeSources,
    withdrawFromHost,
  };
}

/** The adapters and context wirings every area reads: the file system, the manifests, auth, host
 * registration and distribution. Built once per graph. */
export function wireBase({ projectRoot, verbose, token, output, tools }: BaseOptions) {
  const logger = output ?? createOutput(verbose);
  const fs = new JsonFileMergerAdapter(new FileAdapter(logger));
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
  const auth = wireAuth({
    projectRoot,
    logger,
    http,
    environment,
    explicitToken: token,
  });
  const currentVersionProvider = new CurrentVersionAdapter();
  const platform = new PlatformAdapter();
  const prompter = terminalPrompter();
  const host = wireHost({ tools, fs, logger });
  // Built ahead of every use case that reads a shared-source claim: it depends only on `fs`
  // and `userConfigDir`, neither of which distribution's own wiring produces.
  const { userSourceReferences } = wireMachineClaims(fs);
  const distribution = wireDistribution({
    fs,
    http,
    tokenProvider: auth.tokenProvider,
    logger,
    projectRoot,
  });
  return {
    ...host,
    ...auth,
    ...distribution,
    tools,
    projectRoot,
    fs,
    logger,
    http,
    environment,
    currentVersionProvider,
    platform,
    prompter,
    manifestRepo,
    userManifestRepo,
    pluginDistributionReader,
    userSourceReferences,
  };
}

export type Base = ReturnType<typeof wireBase>;
