import { join } from "node:path";
import { errorMessage } from "../../../../shared/domain/describe-error.js";
import { tryParseJson } from "../../../../shared/domain/reading/json-file.js";
import { asPlainObject } from "../../../../shared/domain/reading/plain-object.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type {
  InspectDeclaredMarketplacesResult,
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
  readonly toolId: string;
  readonly marketplaceNames: readonly string[];
}

interface Declared {
  readonly file: string;
  readonly names: ReadonlySet<string>;
  readonly sources: ReadonlyMap<string, string>;
}

type Inspected =
  | { readonly kind: "declared"; readonly declared: Declared }
  | { readonly kind: "unparseable"; readonly file: string; readonly reason: string };

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
  platform: string
): UndeclaredMarketplace[] {
  return [...declared.sources]
    .filter(
      ([name, path]) =>
        !command.marketplaceNames.includes(name) &&
        parseBuiltMarketplaceDir(command.projectRoot, path, platform) !== undefined
    )
    .map(([name]) => ({ tool: command.toolId, name, file: declared.file }));
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
    const inspected = await this.inspected(command);
    if (inspected === undefined) return { findings: [], stale: [], unparseable: [] };
    if (inspected.kind === "unparseable") {
      const { file, reason } = inspected;
      return { findings: [], stale: [], unparseable: [{ tool: command.toolId, file, reason }] };
    }
    const { declared } = inspected;
    return {
      findings: missingFrom(declared, command.marketplaceNames, command.toolId),
      stale: staleIn(declared, command, this.platform),
      unparseable: [],
    };
  }

  private async inspected(
    command: InspectDeclaredMarketplacesRequest
  ): Promise<Inspected | undefined> {
    const profile = this.tools.profile(command.toolId);
    const settings = this.untrackedSettingsOf(profile);
    if (settings === undefined) return undefined;
    // A tool that writes its own registration cannot have written one while its binary was out
    // of reach: reporting the absence would report that an uninstalled tool is unconfigured.
    if (!this.canRegisterItself(profile)) return undefined;
    const read = await this.parsedSettings(command.projectRoot, settings.file);
    if (!read.ok) return { kind: "unparseable", file: settings.file, reason: read.reason };
    return {
      kind: "declared",
      declared: {
        file: settings.file,
        names: settings.registration.declaredMarketplaceNames(read.value),
        sources: settings.registration.declaredMarketplaceSources(read.value),
      },
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

  /** A file that is absent declares nothing; one that exists but is not a JSON object is no answer. */
  private async parsedSettings(
    projectRoot: string,
    file: string
  ): Promise<{ ok: true; value: unknown } | { ok: false; reason: string }> {
    const content = await this.fs.readFileIfReadable(join(projectRoot, file));
    if (content === undefined) return { ok: true, value: undefined };
    const parsed = tryParseJson(content);
    if (!parsed.ok) return { ok: false, reason: errorMessage(parsed.error) };
    if (asPlainObject(parsed.value) === null)
      return { ok: false, reason: "the root is not an object" };
    return parsed;
  }

  private canRegisterItself(tool: SettingsDeclaringTool): boolean {
    const activation = tool.kind === "ai" ? tool.nativeActivation() : undefined;
    if (activation === undefined) return true;
    return this.hostAvailable(activation.hostBinary());
  }
}
