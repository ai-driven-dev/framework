import { describe, expect, it, vi } from "vitest";
import {
  localFrameworkSource,
  remoteFrameworkSource,
} from "../../../src/contexts/distribution/contract/framework-source.js";
import { ResolveSetupSource } from "../../../src/orchestration/setup/resolve-setup-source.js";
import { SetupFlow } from "../../../src/orchestration/setup/setup-flow.js";
import { flowTools } from "../../shared/testing/registered-tools.builder.js";

function flowOf(params: Partial<ConstructorParameters<typeof SetupFlow>[0]> = {}): SetupFlow {
  return new SetupFlow({
    ...flowTools(),
    supportsUserScopeActivation: () => true,
    projectRoot: "/project",
    ...params,
  });
}

describe("ResolveSetupSource", () => {
  it("asks for no source when the flow opts out of the default marketplace", async () => {
    const resolve = vi.fn();

    const source = await new ResolveSetupSource(resolve).execute(
      flowOf({ registerDefaultMarketplace: false })
    );

    expect(source).toBeNull();
    expect(resolve).not.toHaveBeenCalled();
  });

  it("hands the project root, the --source and whether anyone can answer to the question", async () => {
    const chosen = remoteFrameworkSource("owner/repo");
    const resolve = vi.fn().mockResolvedValue(localFrameworkSource("/framework-source"));

    const source = await new ResolveSetupSource(resolve).execute(
      flowOf({ source: chosen, interactive: true })
    );

    expect(resolve).toHaveBeenCalledWith({
      projectRoot: "/project",
      sourceFromCli: chosen,
      interactive: true,
    });
    expect(source).toEqual(localFrameworkSource("/framework-source"));
  });

  it("lets a refusal reach the caller", async () => {
    const resolve = vi.fn().mockRejectedValue(new Error("no source"));

    await expect(new ResolveSetupSource(resolve).execute(flowOf())).rejects.toThrow("no source");
  });
});
