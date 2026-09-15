import { spawnSync } from "node:child_process";
import type { HostMarketplaceRegistryReader } from "../domain/ports/host-marketplace-registry-reader.js";
import type {
  NativeMarketplaceSourceListContract,
  NativeMarketplaceSourceReader,
  NativeMarketplaceSourceReading,
} from "../domain/ports/native-marketplace-source-reader.js";
import {
  hostExecutableLookup,
  resolveExecutableOnPath,
  runsThroughShell,
  windowsCommandLine,
} from "./executable-on-path.js";

export class HostRegistryMarketplaceSourceReaderAdapter implements NativeMarketplaceSourceReader {
  constructor(private readonly hostReader: HostMarketplaceRegistryReader) {}

  async read(_projectRoot: string): Promise<NativeMarketplaceSourceReading> {
    const reading = await this.hostReader.read();
    if (reading.entries !== undefined)
      return {
        location: reading.location,
        entries: new Map(
          [...reading.entries].map(([name, source]) => [
            name,
            { kind: "registry" as const, source },
          ])
        ),
      };
    if (reading.absent === true) return { location: reading.location, entries: new Map() };
    return {
      location: reading.location,
      unreadable: reading.unreadable ?? "Host marketplace registry is unreadable",
    };
  }
}

/** Uses only a host's structured, effective listing with the requesting project's CWD. */
export class NativeMarketplaceSourceReaderAdapter implements NativeMarketplaceSourceReader {
  constructor(private readonly contract: NativeMarketplaceSourceListContract) {}

  async read(projectRoot: string): Promise<NativeMarketplaceSourceReading> {
    const location = `${this.contract.binary} ${this.contract.args.join(" ")} (cwd ${projectRoot})`;
    const options = {
      cwd: projectRoot,
      encoding: "utf-8" as const,
      timeout: 30000,
      stdio: ["ignore", "pipe", "pipe"] as ["ignore", "pipe", "pipe"],
      shell: false,
    };
    const executable = resolveExecutableOnPath(this.contract.binary, hostExecutableLookup());
    const result =
      executable !== undefined && runsThroughShell(executable)
        ? spawnSync(windowsCommandLine(executable, this.contract.args), { ...options, shell: true })
        : spawnSync(this.contract.binary, [...this.contract.args], options);
    if (result.error !== undefined || result.status !== 0) {
      const detail = result.error?.message ?? result.stderr?.trim() ?? "unknown failure";
      return { location, unreadable: `${this.contract.unavailableMessage}: ${detail}` };
    }
    if (this.contract.parse === undefined)
      return {
        location,
        unreadable: this.contract.unverifiedMessage,
      };
    try {
      return { location, entries: this.contract.parse(result.stdout ?? "") };
    } catch (error) {
      return {
        location,
        unreadable: `${this.contract.binary} marketplace list could not prove a source: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
