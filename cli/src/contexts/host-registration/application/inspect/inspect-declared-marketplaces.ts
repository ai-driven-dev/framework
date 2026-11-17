import { join } from "node:path";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { MarketplaceRegistrationAnswers } from "../../../tools/contract/tool-profile.js";
import type {
  InspectDeclaredMarketplacesResult,
  UndeclaredMarketplace,
} from "../../contract/inspect-declared-marketplaces-result.js";
import type { SettingsDeclaringTool } from "../../ports/host-tool.js";

export interface InspectDeclaredMarketplacesCommand {
  readonly projectRoot: string;
  readonly tools: ToolCatalog;
  readonly toolIds: readonly string[];
  readonly marketplaceNames: readonly string[];
}

/**
 * Asks each tool's machine-local settings file whether it still declares the marketplaces the
 * project registers. That file is deliberately untracked (absolute paths), so nothing else would
 * notice it emptied, edited or deleted.
 */
export class InspectDeclaredMarketplaces {
  constructor(
    private readonly fs: FileReader,
    /** Whether the host CLI behind a `NativeActivation.hostBinary()` is on the PATH. */
    private readonly hostAvailable: (binary: string) => boolean
  ) {}

  async execute(
    command: InspectDeclaredMarketplacesCommand
  ): Promise<InspectDeclaredMarketplacesResult> {
    const findings: UndeclaredMarketplace[] = [];
    if (command.marketplaceNames.length === 0) return { findings };
    for (const toolId of command.toolIds) {
      const profile = command.tools.profile(toolId);
      const settings = this.untrackedSettingsOf(profile);
      if (settings === undefined) continue;
      // A tool that writes its own registration cannot have written one while its binary was out
      // of reach: reporting the absence would report that an uninstalled tool is unconfigured.
      if (!this.canRegisterItself(profile)) continue;
      const registered = await this.registeredNames(command.projectRoot, settings);
      for (const name of command.marketplaceNames) {
        if (registered.has(name)) continue;
        findings.push({ tool: toolId, name, file: settings.file });
      }
    }
    return { findings };
  }

  private untrackedSettingsOf(
    tool: SettingsDeclaringTool
  ): { file: string; registration: MarketplaceRegistrationAnswers } | undefined {
    if (tool.kind !== "ai") return undefined;
    // No machine-local file means the tool writes no machine-local registration at all, so
    // there is nothing here to check.
    const registration = tool.marketplaceRegistration();
    const file = tool.machineLocalFiles()[0];
    return registration === null || file === undefined ? undefined : { file, registration };
  }

  private async registeredNames(
    projectRoot: string,
    settings: { file: string; registration: MarketplaceRegistrationAnswers }
  ): Promise<Set<string>> {
    const path = join(projectRoot, settings.file);
    if (!(await this.fs.fileExists(path))) return new Set();
    let parsed: unknown;
    try {
      parsed = JSON.parse(await this.fs.readFile(path));
    } catch {
      return new Set();
    }
    return new Set(settings.registration.declaredMarketplaceNames(parsed));
  }

  private canRegisterItself(tool: SettingsDeclaringTool): boolean {
    const activation = tool.kind === "ai" ? tool.nativeActivation() : undefined;
    if (activation === undefined) return true;
    return this.hostAvailable(activation.hostBinary());
  }
}
