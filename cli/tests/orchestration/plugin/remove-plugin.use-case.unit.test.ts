import { describe, expect, it, vi } from "vitest";
import type { WithdrawFromHost } from "../../../src/contexts/host-registration/application/withdraw/withdraw-from-host.use-case.js";
import type {
  ProveClaimedRefRequest,
  ProveMarketplaceRemovalRequest,
  ProvenHostRef,
  ProvenMarketplaceRemoval,
  WithdrawalRequest,
  WithdrawalStepRequest,
  WithdrawPluginRequest,
} from "../../../src/contexts/host-registration/application/withdraw/withdrawal.js";
import { withNativeRegistration } from "../../../src/contexts/host-registration/domain/native-registration/native-host-profile.js";
import type { ProjectPluginWithdrawalSteps } from "../../../src/contexts/installation/application/removal/project-plugin-withdrawal.js";
import type { RemovePluginRequest } from "../../../src/contexts/installation/application/removal/remove-plugin.use-case.js";
import { RecordedPlugin } from "../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { defineAiTool } from "../../../src/contexts/tools/domain/profile/define-tool.js";
import {
  RemovePlugin,
  type RemovePluginDeps,
} from "../../../src/orchestration/plugin/remove-plugin.use-case.js";
import { nativePlugins, sectionsOf } from "../../contexts/tools/testing/plugin-mode.builder.js";
import { anEmptyContract } from "../../shared/testing/empty-build-contract.builder.js";

const ROOT = "/project";
const HOME = "/home/someone";

/** A host that confirms every withdrawal and records each request it was sent. */
class RecordingHost implements Pick<WithdrawFromHost, "execute"> {
  readonly requests: WithdrawalRequest[] = [];
  execute(command: WithdrawPluginRequest): Promise<boolean | undefined>;
  execute(command: ProveClaimedRefRequest): Promise<ProvenHostRef>;
  execute(command: ProveMarketplaceRemovalRequest): Promise<ProvenMarketplaceRemoval>;
  execute(command: WithdrawalStepRequest): Promise<void>;
  async execute(command: WithdrawalRequest): Promise<unknown> {
    this.requests.push(command);
    return command.kind === "withdraw-plugin" ? true : undefined;
  }
}

function plugin(marketplace: string | undefined) {
  return RecordedPlugin.fromJSON({
    name: "aidd-dev",
    source: { kind: "local", path: "/fixture" },
    version: "1.0.0",
    strict: false,
    files: {},
    scope: "project",
    ...(marketplace === undefined ? {} : { marketplace }),
  });
}

/** The steps the scenario hands installation, captured from one removal. */
async function stepsOf(owned: (toolId: string, ref: string) => boolean = () => false) {
  const host = new RecordingHost();
  const claims: RemovePluginDeps["claims"] = {
    home: HOME,
    isMachineOwned: async (toolId, ref) => owned(toolId, ref),
    guardMessage: async () => undefined,
    resolveCacheCandidate: async () => null,
    detachNativeRefs: vi.fn(async () => undefined),
    detachUserPlugin: vi.fn(async () => undefined),
  };
  const records: RemovePluginDeps["records"] = {
    refOf: () => undefined,
    withoutRef: (record) => record,
    loadRecords: async () => new Map(),
    saveRecords: async () => undefined,
  };
  let steps: ProjectPluginWithdrawalSteps | undefined;
  const remove = {
    execute: async (request: RemovePluginRequest) => {
      steps = request.withdrawal;
    },
  };
  await new RemovePlugin({ remove, withdrawFromHost: host, claims, records }).execute({
    pluginName: "aidd-dev",
    toolIds: "all",
    projectRoot: ROOT,
  });
  if (steps === undefined) throw new Error("the removal was not handed its steps");
  return { steps, host, claims };
}

/** A tool that enables plugins through its own CLI, per project or machine-wide. */
function activatingTool(toolId: string, scoped: boolean) {
  const profile = defineAiTool({
    toolId,
    directory: ".fake/",
    toolSuffix: ".fake.md",
    signalDir: null,
    displayName: "Fake",
    buildContracts: { flat: () => anEmptyContract() },
    capabilities: sectionsOf(nativePlugins()),
    linkSyntax: [],
  });
  return withNativeRegistration(profile, {
    activation: {
      binary: "fake",
      enableVerb: "add",
      disableVerb: "remove",
      pluginCacheDir: "{home}/.fake/cache",
      ...(scoped ? { scopeArgs: { project: ["--local"], user: ["--user"] } } : {}),
    },
  });
}

const claude = activatingTool("project-wide", true);
const cursor = activatingTool("machine-wide", false);
const CLAUDE = claude.toolId;
const CURSOR = cursor.toolId;

describe("removing a plugin", () => {
  it("asks nothing of the host about a plugin that carries no marketplace", async () => {
    const { steps, host } = await stepsOf();
    const reach = { tool: claude, plugin: plugin(undefined), projectRoot: ROOT, registrations: {} };

    await steps.assertSource({ ...reach, toolId: CLAUDE });

    expect(await steps.withdraw(reach)).toBeUndefined();
    expect(host.requests).toStrictEqual([]);
  });

  it("proves the source against the machine claims of the tool being removed", async () => {
    const { steps, host } = await stepsOf((toolId) => toolId === CLAUDE);
    const reach = {
      tool: claude,
      plugin: plugin("framework"),
      projectRoot: ROOT,
      registrations: {},
    };

    await steps.assertSource({ ...reach, toolId: CLAUDE });

    const [request] = host.requests;
    expect(request).toMatchObject({
      kind: "prove-project-source",
      plugin: { name: "aidd-dev", marketplace: "framework", scope: "project" },
      projectRoot: ROOT,
    });
    if (request?.kind !== "prove-project-source") throw new Error("no source proof was asked");
    expect(await request.isMachineOwned("aidd-dev@framework")).toBe(true);
  });

  it("withdraws from the host under the plugin cache of the machine home", async () => {
    const { steps, host } = await stepsOf();
    const reach = {
      tool: claude,
      plugin: plugin("framework"),
      projectRoot: ROOT,
      registrations: {},
    };

    expect(await steps.withdraw(reach)).toBe(true);

    expect(host.requests[0]).toMatchObject({
      kind: "withdraw-plugin",
      plugin: { name: "aidd-dev", marketplace: "framework", scope: "project" },
      pluginCacheRoot: claude.nativeActivation()?.pluginCacheRoot(HOME),
    });
  });

  it("asks the machine claims whether they own a ref of a tool", async () => {
    const owned = await stepsOf((toolId, ref) => toolId === CURSOR && ref === "r");

    expect(await owned.steps.isMachineOwned(CURSOR, "r")).toBe(true);
    expect(await owned.steps.isMachineOwned(CLAUDE, "r")).toBe(false);
  });

  it("lets go of the machine claims the removal held", async () => {
    const { steps, claims } = await stepsOf();
    const refs = new Map([[CLAUDE, ["r"]]]);

    await steps.detachNativeRefs(ROOT, refs);
    await steps.detachUserPlugin(CLAUDE, "aidd-dev", ROOT);

    expect(claims.detachNativeRefs).toHaveBeenCalledWith(ROOT, refs);
    expect(claims.detachUserPlugin).toHaveBeenCalledWith(CLAUDE, "aidd-dev", ROOT);
  });
});
