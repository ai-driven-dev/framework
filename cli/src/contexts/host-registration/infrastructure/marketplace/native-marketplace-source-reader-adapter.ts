import {
  type SpawnSyncOptionsWithStringEncoding,
  type SpawnSyncReturns,
  spawnSync,
} from "node:child_process";
import { errorMessage } from "../../../../shared/domain/describe-error.js";
import type { NativeMarketplaceSourceReading } from "../../domain/record/native-marketplace-source-reading.js";
import type { HostMarketplaceSources } from "../../ports/host-marketplace-sources.js";
import {
  hostExecutableLookup,
  resolveExecutableOnPath,
  runsThroughShell,
  windowsCommandLine,
} from "../executable-on-path.js";
import type { NativeMarketplaceSourceListContract } from "./native-marketplace-source-list-contract.js";

/** Uses only a host's structured, effective listing with the requesting project's CWD. */
export class NativeMarketplaceSourceReaderAdapter implements HostMarketplaceSources {
  constructor(private readonly contract: NativeMarketplaceSourceListContract) {}

  async read(projectRoot: string): Promise<NativeMarketplaceSourceReading> {
    const { binary, args } = this.contract;
    const location = `${binary} ${args.join(" ")} (cwd ${projectRoot})`;
    const result = runList(this.contract, projectRoot);
    if (result.error !== undefined || result.status !== 0) {
      const detail = result.error?.message ?? result.stderr?.trim() ?? "unknown failure";
      return { location, unreadable: `${this.contract.unavailableMessage}: ${detail}` };
    }
    return { location, ...this.parsed(result.stdout ?? "") };
  }

  private parsed(stdout: string): Pick<NativeMarketplaceSourceReading, "entries" | "unreadable"> {
    if (this.contract.parse === undefined) return { unreadable: this.contract.unverifiedMessage };
    try {
      return { entries: this.contract.parse(stdout) };
    } catch (error) {
      const reason = errorMessage(error);
      return {
        unreadable: `${this.contract.binary} marketplace list could not prove a source: ${reason}`,
      };
    }
  }
}

function runList(
  contract: NativeMarketplaceSourceListContract,
  projectRoot: string
): SpawnSyncReturns<string> {
  const options: SpawnSyncOptionsWithStringEncoding = {
    cwd: projectRoot,
    encoding: "utf-8",
    timeout: 30000,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  };
  const executable = resolveExecutableOnPath(contract.binary, hostExecutableLookup());
  return executable !== undefined && runsThroughShell(executable)
    ? spawnSync(windowsCommandLine(executable, contract.args), { ...options, shell: true })
    : spawnSync(contract.binary, [...contract.args], options);
}
