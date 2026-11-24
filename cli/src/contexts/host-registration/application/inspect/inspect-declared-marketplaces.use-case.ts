import { join } from "node:path";
import { tryParseJson } from "../../../../shared/domain/reading/json-file.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type {
  InspectDeclaredMarketplacesResult,
  StaleDeclaration,
  UndeclaredMarketplace,
} from "../../contract/inspect-declared-marketplaces-result.js";
import type {
  MarketplaceRegistrationAnswers,
  NativeHostCatalog,
} from "../../contract/native-registration-spec.js";
import { parseBuiltMarketplaceDir } from "../../domain/source/built-marketplace-location.js";
import type { SettingsDeclaringTool } from "../../ports/host-tool.js";

export interface InspectDeclaredMarketplacesRequest {
  readonly projectRoot: string;
  readonly toolIds: readonly string[];
  readonly marketplaceNames: readonly string[];
}

interface Declared {
  readonly file: string;
  readonly names: ReadonlySet<string>;
  readonly sources: ReadonlyMap<string, string>;
}

function missingFrom(
  declared: Declared,
  registered: readonly string[],
  tool: string
): UndeclaredMarketplace[] {
  return registered
    .filter((name) => !declared.names.has(name))
    .map((name) => ({ tool, name, file: declared.file }));
}

function staleIn(
  declared: Declared,
  command: InspectDeclaredMarketplacesRequest,
  where: { tool: string; platform: string }
): StaleDeclaration[] {
  const { tool, platform } = where;
  return [...declared.sources]
    .filter(
      ([name, path]) =>
        !command.marketplaceNames.includes(name) &&
        parseBuiltMarketplaceDir(command.projectRoot, path, platform) !== undefined
    )
    .map(([name]) => ({ tool, name, file: declared.file }));
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
    /** Decides how a stored path is compared with the project's own. */
    private readonly platform: string,
    private readonly tools: NativeHostCatalog
  ) {}

  async execute(
    command: InspectDeclaredMarketplacesRequest
  ): Promise<InspectDeclaredMarketplacesResult> {
    const findings: UndeclaredMarketplace[] = [];
    const stale: StaleDeclaration[] = [];
    for (const toolId of command.toolIds) {
      const declared = await this.declaredBy(command, toolId);
      if (declared === undefined) continue;
      findings.push(...missingFrom(declared, command.marketplaceNames, toolId));
      stale.push(...staleIn(declared, command, { tool: toolId, platform: this.platform }));
    }
    return { findings, stale };
  }

  private async declaredBy(
    command: InspectDeclaredMarketplacesRequest,
    toolId: string
  ): Promise<Declared | undefined> {
    const profile = this.tools.profile(toolId);
    const settings = this.untrackedSettingsOf(profile);
    if (settings === undefined) return undefined;
    // A tool that writes its own registration cannot have written one while its binary was out
    // of reach: reporting the absence would report that an uninstalled tool is unconfigured.
    if (!this.canRegisterItself(profile)) return undefined;
    const parsed = await this.parsedSettings(command.projectRoot, settings.file);
    return {
      file: settings.file,
      names: settings.registration.declaredMarketplaceNames(parsed),
      sources: settings.registration.declaredMarketplaceSources(parsed),
    };
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

  private async parsedSettings(projectRoot: string, file: string): Promise<unknown> {
    const content = await this.fs.readFileIfReadable(join(projectRoot, file));
    const parsed = content === undefined ? undefined : tryParseJson(content);
    return parsed?.ok === true ? parsed.value : undefined;
  }

  private canRegisterItself(tool: SettingsDeclaringTool): boolean {
    const activation = tool.kind === "ai" ? tool.nativeActivation() : undefined;
    if (activation === undefined) return true;
    return this.hostAvailable(activation.hostBinary());
  }
}
