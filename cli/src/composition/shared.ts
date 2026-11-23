import { join } from "node:path";
import pkg from "../../package.json" with { type: "json" };
import { hostPortsOver } from "../contexts/host-registration/application/host-ports-over.js";
import { WithdrawFromHost } from "../contexts/host-registration/application/withdraw/withdraw-from-host.use-case.js";
import { JsonFileMergerAdapter } from "../contexts/installation/infrastructure/json-file-merger-adapter.js";
import { ManifestRepositoryAdapter } from "../contexts/installation/infrastructure/manifest-repository-adapter.js";
import { PlatformAdapter } from "../contexts/installation/infrastructure/platform-adapter.js";
import { UserManifestRepositoryAdapter } from "../contexts/installation/infrastructure/user-manifest-repository-adapter.js";
import { pluginManifestProbes } from "../contexts/translate/domain/plugin-format.js";
import { InquirerPrompterAdapter } from "../presentation/terminal/inquirer-prompter.adapter.js";
import { OutputAdapter } from "../presentation/terminal/output.adapter.js";
import type { Output } from "../presentation/terminal/output.model.js";
import { SilentPrompterAdapter } from "../presentation/terminal/silent-prompter.adapter.js";
import type { HintedMessage } from "../shared/domain/describe-error.js";
import { AIDD_DIR } from "../shared/domain/layout/aidd-layout.js";
import { atomicWriteFile } from "../shared/infrastructure/atomic-write.js";
import { EnvironmentAdapter } from "../shared/infrastructure/environment-adapter.js";
import { FileAdapter } from "../shared/infrastructure/file-adapter.js";
import { HttpClient } from "../shared/infrastructure/http-client.js";
import { wireAuth } from "./contexts/auth.js";
import { wireDistribution } from "./contexts/distribution.js";
import { wireHostRegistration } from "./contexts/host-registration.js";
import {
  heldByMachineLock,
  registrationRecordStore,
  wireMachineClaims,
  withRecordsBeside,
} from "./contexts/machine-claims.js";
import type { RegisteredCatalog } from "./contexts/tools.js";
import { homeDirResolver, userConfigDir } from "./user-config-dir.js";

const plainText = (message: string | HintedMessage): string =>
  typeof message === "string" ? message : message.text;

/** The output factory of a run that stops through `end`. `words` says a caught value a log line
 * carries and `describeMessage` a message with its hint; the entry point hands in the catalogue's,
 * the defaults read only a plain one. */
export function outputEndingWith(
  end: (code: number) => never,
  words: (cause: unknown) => string = String,
  describeMessage: (message: string | HintedMessage) => string = plainText
): (verbose: boolean) => Output {
  return (verbose) => new OutputAdapter(verbose, end, words, describeMessage);
}

/** The output of a run: it writes to the terminal and ends the process. */
export function createOutput(verbose: boolean): Output {
  return outputEndingWith((code) => process.exit(code))(verbose);
}

/** What a container is built from: where it runs, how it logs and the catalog its wiring reads. */
export interface BaseOptions {
  projectRoot: string;
  verbose: boolean;
  token?: string;
  output?: Output;
  tools: RegisteredCatalog;
}

/** Asks a person when a terminal is attached, and answers its defaults when none is. */
function terminalPrompter() {
  return process.stdout.isTTY ? new InquirerPrompterAdapter() : new SilentPrompterAdapter();
}

/** What each host registers a plugin through, read once and reused wherever a use case needs the
 * scope a plugin is actually registered at: removal, clean, and doctor's own registration check. */
function wireHost(parts: {
  tools: RegisteredCatalog;
  fs: JsonFileMergerAdapter;
  logger: Output;
  home: string;
}) {
  const { tools, fs, logger, home } = parts;
  const {
    hostActions: nativePluginActivators,
    marketplaceRegistries: hostMarketplaceRegistries,
    marketplaceSources: nativeSources,
    pluginRegistries: hostPluginRegistries,
  } = wireHostRegistration(tools, home);
  const withdrawFromHost = new WithdrawFromHost(
    fs,
    logger,
    hostPortsOver({
      activators: nativePluginActivators,
      pluginRegistries: hostPluginRegistries,
      marketplaceRegistries: hostMarketplaceRegistries,
      sources: nativeSources,
    })
  );
  return {
    nativePluginActivators,
    hostMarketplaceRegistries,
    hostPluginRegistries,
    nativeSources,
    withdrawFromHost,
  };
}

type Logging = ReturnType<typeof createOutput>;

/** The file system and the manifests kept on it. */
function wireStorage({ projectRoot, tools }: BaseOptions, logger: Logging) {
  const fs = new JsonFileMergerAdapter(new FileAdapter(logger));
  const resolveToolId = (raw: string) => tools.toolId(raw);
  const files = { atomicWriter: atomicWriteFile, resolveToolId };
  const projectRecords = registrationRecordStore(() => join(projectRoot, AIDD_DIR), files);
  const manifestRepo = withRecordsBeside(
    new ManifestRepositoryAdapter(projectRoot, { ...files, records: projectRecords }),
    projectRecords
  );
  const userRecords = registrationRecordStore(userConfigDir, files);
  const userManifestRepo = heldByMachineLock(
    withRecordsBeside(
      new UserManifestRepositoryAdapter(userConfigDir, { ...files, records: userRecords }),
      userRecords
    )
  );
  return { fs, manifestRepo, userManifestRepo };
}

/** What reaches beyond the machine: the network, the token and the marketplaces. */
function wireRemote(
  { projectRoot, token, tools }: BaseOptions,
  { logger, fs }: { logger: Logging; fs: MergingFileSystem }
) {
  const http = new HttpClient();
  const environment = new EnvironmentAdapter(process.env);
  const auth = wireAuth({ projectRoot, logger, http, environment, explicitToken: token });
  const distribution = wireDistribution({
    fs,
    http,
    tokenProvider: auth.tokenProvider,
    logger,
    projectRoot,
    manifestProbes: pluginManifestProbes(tools),
  });
  return { http, environment, ...auth, ...distribution };
}

type MergingFileSystem = ReturnType<typeof wireStorage>["fs"];

/** The adapters and context wirings every area reads: the file system, the manifests, auth, host
 * registration and distribution. Built once per graph. */
export function wireBase(options: BaseOptions) {
  const { projectRoot, verbose, output, tools } = options;
  const logger = output ?? createOutput(verbose);
  const storage = wireStorage(options, logger);
  const remote = wireRemote(options, { logger, fs: storage.fs });
  const homedir = homeDirResolver();
  const host = wireHost({ tools, fs: storage.fs, logger, home: homedir() });
  // Built ahead of every use case that reads a shared-source claim: it depends only on `fs`
  // and `userConfigDir`, neither of which distribution's own wiring produces.
  const { userSourceReferences } = wireMachineClaims(storage.fs);
  return {
    ...host,
    ...remote,
    ...storage,
    homedir,
    tools,
    projectRoot,
    logger,
    currentVersion: pkg.version,
    platform: new PlatformAdapter(),
    prompter: terminalPrompter(),
    userSourceReferences,
  };
}

export type Base = ReturnType<typeof wireBase>;
