import { join } from "node:path";
import { tryParseJson } from "../../../../shared/domain/reading/json-file.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type {
  InspectDeclaredMarketplacesResult,
  UndeclaredMarketplace,
} from "../../contract/inspect-declared-marketplaces-result.js";
import type {
  MarketplaceRegistrationAnswers,
  NativeHostCatalog,
} from "../../contract/native-registration-spec.js";
import type { SettingsDeclaringTool } from "../../ports/host-tool.js";

export interface InspectDeclaredMarketplacesRequest {
  readonly projectRoot: string;
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
    private readonly hostAvailable: (binary: string) => boolean,
    private readonly tools: NativeHostCatalog
  ) {}

  async execute(
    command: InspectDeclaredMarketplacesRequest
  ): Promise<InspectDeclaredMarketplacesResult> {
    const findings: UndeclaredMarketplace[] = [];
    for (const toolId of command.toolIds)
      findings.push(...(await this.undeclaredBy(command, toolId)));
    return { findings };
  }

  private async undeclaredBy(
    command: InspectDeclaredMarketplacesRequest,
    toolId: string
  ): Promise<UndeclaredMarketplace[]> {
    const profile = this.tools.profile(toolId);
    const settings = this.untrackedSettingsOf(profile);
    if (settings === undefined) return [];
    // A tool that writes its own registration cannot have written one while its binary was out
    // of reach: reporting the absence would report that an uninstalled tool is unconfigured.
    if (!this.canRegisterItself(profile)) return [];
    const registered = await this.registeredNames(command.projectRoot, settings);
    return command.marketplaceNames
      .filter((name) => !registered.has(name))
      .map((name) => ({ tool: toolId, name, file: settings.file }));
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
    const content = await this.fs.readFileIfReadable(path);
    const parsed = content === undefined ? undefined : tryParseJson(content);
    if (parsed?.ok !== true) return new Set();
    return new Set(settings.registration.declaredMarketplaceNames(parsed.value));
  }

  private canRegisterItself(tool: SettingsDeclaringTool): boolean {
    const activation = tool.kind === "ai" ? tool.nativeActivation() : undefined;
    if (activation === undefined) return true;
    return this.hostAvailable(activation.hostBinary());
  }
}
