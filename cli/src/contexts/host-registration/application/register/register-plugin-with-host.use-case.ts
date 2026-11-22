import type { HintedMessage } from "../../../../shared/domain/describe-error.js";
import type { Scope } from "../../../../shared/domain/scope.js";
import type { ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { BuiltCatalogs } from "../../contract/built-catalogs.js";
import type { ClaimsView } from "../../contract/claims-view.js";
import { judgeRegistration } from "../../domain/policy/registration-policy.js";
import type { CatalogIdentityReader } from "../../ports/catalog-identity-reader.js";
import type { HostActions } from "../../ports/host-actions.js";
import type { CatalogProbeTool, NativeHostTool } from "../../ports/host-tool.js";
import { bestEffortNativeCall, skippedWarning } from "../confirm-native-call.use-case.js";
import { enableRefs } from "./enable-refs.js";
import { nativeCatalogProof } from "./native-catalog-proof.js";
import type {
  HostRegistrationOutcome,
  RegisteredMarketplace,
  RegistrationLogger,
} from "./registration-outcome.js";
import {
  type HostRegistries,
  type RegistrationRun,
  type RegistrationSubject,
  warnRegistration,
} from "./registration-run.js";
import { type SettledMarketplaces, settleMarketplaces } from "./settle-marketplaces.js";

export interface RegisterPluginWithHostRequest<M extends RegistrationSubject> {
  readonly toolId: ToolId;
  readonly projectRoot: string;
  readonly scope: Scope;
  readonly marketplaces: readonly M[];
  readonly claims: ClaimsView;
  readonly build: BuiltCatalogs<M>;
  /** The refs this run enables, given the host name each proven marketplace answers to. */
  readonly refsToEnable: (hostNameByAlias: ReadonlyMap<string, string>) => string[];
  readonly userCacheRoot: () => string;
  /** Every warning goes to the logger and is kept, in order, for the caller's result. */
  readonly sink: {
    readonly logger: RegistrationLogger;
    readonly warnings: (string | HintedMessage)[];
  };
}

export type RegisterPluginWithHostResult =
  | { readonly status: "unconfigured" }
  | { readonly status: "binary-missing"; readonly binary: string }
  | { readonly status: "activated"; readonly outcome: HostRegistrationOutcome };

/** What the use case holds: the file reader, the native plugin CLI activators keyed by the
 * `binary` each profile declares, and the platform whose path rules compare what a host stored
 * with what this run resolved. Only a tool whose profile declares a registry is ever looked up
 * in `hosts`, so a tool absent from a map still registers. */
export interface RegisterPluginWithHostDeps {
  readonly fs: FileReader;
  readonly identities: CatalogIdentityReader;
  readonly activators: ReadonlyMap<string, HostActions>;
  readonly hosts: HostRegistries;
  readonly platform: string;
}

interface NativeHost {
  readonly profile: NativeHostTool & CatalogProbeTool;
  readonly binary: string;
  readonly activator: HostActions;
}

export class RegisterPluginWithHost {
  constructor(
    private readonly deps: RegisterPluginWithHostDeps,
    private readonly tools: ToolCatalog
  ) {}

  /** Registers every marketplace with the tool's own CLI and enables the refs this run asks
   * for. Each step is independently best-effort: one failing plugin or marketplace warns and
   * lets the others through. A host refusal is reported; anything else propagates. */
  async execute<M extends RegistrationSubject>(
    command: RegisterPluginWithHostRequest<M>
  ): Promise<RegisterPluginWithHostResult> {
    const host = this.nativeHost(command.toolId);
    if (host === undefined) return { status: "unconfigured" };
    const { activator, binary } = host;
    if (!activator.isAvailable()) return { status: "binary-missing", binary };
    const run = this.runOf(command, host);
    const settled = await settleMarketplaces(run, command);
    const { marketplaces, preservedMarketplaces, catalogClaims, buildFailed } = settled;
    const outcome = { marketplaces, preservedMarketplaces, catalogClaims, buildFailed };
    const proven = await upgradeProven(run, settled);
    const pluginRefs = await enableRefs(run, command, proven);
    return { status: "activated", outcome: { ...outcome, pluginRefs } };
  }

  private nativeHost(toolId: ToolId): NativeHost | undefined {
    const profile = this.tools.aiProfileIfAny(toolId);
    const binary = profile?.nativeActivation()?.hostBinary();
    const activator = binary === undefined ? undefined : this.deps.activators.get(binary);
    if (profile === null || binary === undefined || activator === undefined) return undefined;
    return { profile, binary, activator };
  }

  private runOf<M extends RegistrationSubject>(
    command: RegisterPluginWithHostRequest<M>,
    { profile, activator }: NativeHost
  ): RegistrationRun {
    const { toolId, projectRoot, claims, userCacheRoot, sink } = command;
    const { fs, identities, hosts, platform } = this.deps;
    return {
      toolId,
      profile,
      activator,
      fs,
      identities,
      hosts,
      projectRoot,
      claims,
      userCacheRoot,
      platform,
      logger: sink.logger,
      warnings: sink.warnings,
    };
  }
}

/** The registrations still proven after this run, each one a marketplace the host held before
 * asked to upgrade. */
async function upgradeProven(
  run: RegistrationRun,
  settled: SettledMarketplaces
): Promise<RegisteredMarketplace[]> {
  const { catalogClaims, addedHostNames } = settled;
  const stillProven: RegisteredMarketplace[] = [];
  for (const registration of settled.marketplaces) {
    const fresh = catalogClaims.find((claim) => claim.hostName === registration.hostName);
    const proof = await nativeCatalogProof(run, registration.hostName, fresh);
    if (judgeRegistration({ intent: "register", ...proof }).outcome === "refuse") continue;
    stillProven.push(registration);
    if (!addedHostNames.has(registration.hostName))
      bestEffortNativeCall(
        () => run.activator.upgradeMarketplaces(registration.hostName),
        skippedWarning(`upgrade marketplace '${registration.hostName}'`),
        (message) => warnRegistration(run, message)
      );
  }
  return stillProven;
}
