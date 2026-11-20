import { describe, expect, it } from "vitest";
import type { AgentPluginPlacement } from "../../../src/contexts/installation/application/agents/agent-plugin-hosts.js";
import { RefreshAgentPlugins } from "../../../src/orchestration/agent-models/refresh-agent-plugins.js";
import type { Scope } from "../../../src/shared/domain/scope.js";
import type { AiToolId, ToolId } from "../../../src/shared/domain/tool.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";

const PROJECT = "/project";

type Placed = Partial<Record<keyof AgentPluginPlacement<AiToolId>, boolean>>;

function refreshOver(placed: Placed, activationErrors: string[] = []) {
  const calls: string[] = [];
  const activations: { toolIds: readonly ToolId[]; scope?: Scope }[] = [];
  const useCase = new RefreshAgentPlugins(
    {
      locate: async <Host extends string>(hosts: readonly Host[]) => ({
        userPlugins: placed.userPlugins ? hosts : [],
        projectPlugins: placed.projectPlugins ? hosts : [],
        installed: placed.installed ? hosts : [],
        machine: placed.machine ? hosts : [],
      }),
    },
    {
      execute: async () => {
        calls.push("project");
        return ["project-plugin"];
      },
    },
    {
      execute: async () => {
        calls.push("user");
        return ["user-plugin"];
      },
    },
    {
      execute: async ({ toolIds, scope }) => {
        activations.push({ toolIds: toolIds ?? [], ...(scope === undefined ? {} : { scope }) });
        return {
          activated: [],
          binaryMissing: [],
          warnings: [],
          errors: activationErrors.map((message) => ({ scope: "sync", message })),
          failed: activationErrors.length > 0,
        };
      },
    }
  );
  const run = (scope: Scope) =>
    useCase.execute({ projectRoot: PROJECT, hosts: [TOOL.claude], scope });
  return { run, calls, activations };
}

describe("RefreshAgentPlugins", () => {
  it("does nothing when no host has a plugin placed", async () => {
    const { run, calls, activations } = refreshOver({});

    expect(await run("user")).toStrictEqual([]);
    expect([calls, activations]).toStrictEqual([[], []]);
  });

  it("rewrites the user and the project plugins and names each once", async () => {
    const { run, calls } = refreshOver({
      userPlugins: true,
      projectPlugins: true,
    });

    expect(await run("project")).toStrictEqual(["user-plugin", "project-plugin"]);
    expect(calls).toStrictEqual(["user", "project"]);
  });

  it("activates the hosts this project installed, with no scope", async () => {
    const { run, activations } = refreshOver({ installed: true });

    await run("project");

    expect(activations).toStrictEqual([{ toolIds: [TOOL.claude] }]);
  });

  it("activates the machine-scope hosts only when the scope is user", async () => {
    const { run, activations } = refreshOver({ machine: true });

    await run("project");
    expect(activations).toStrictEqual([]);

    await run("user");
    expect(activations).toStrictEqual([{ toolIds: [TOOL.claude], scope: "user" }]);
  });

  it("activates nothing at user scope when no host is installed on the machine", async () => {
    const { run, activations } = refreshOver({});

    await run("user");

    expect(activations).toStrictEqual([]);
  });

  it("fails with every message the activation reported", async () => {
    const { run } = refreshOver({ installed: true }, ["first", "second"]);

    await expect(run("project")).rejects.toThrow("first\nsecond");
  });

  it("goes on when the activation reported no error", async () => {
    const { run } = refreshOver({ installed: true });

    await expect(run("project")).resolves.toStrictEqual([]);
  });
});
