import { describe, expect, it } from "vitest";
import { PlanPluginInstall } from "../../../../../src/contexts/installation/application/plugin/plan-plugin-install.use-case.js";
import { InvalidPluginScopeError } from "../../../../../src/contexts/installation/domain/installation.error.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { present } from "../../../../shared/testing/present.builder.js";
import { registeredTools } from "../../../../shared/testing/registered-tools.builder.js";

const tools = registeredTools();
const aiIds = tools.idsInCanonicalOrder("ai");
const requiresUser = (id: (typeof aiIds)[number]): boolean =>
  tools.aiProfile(id).plugins()?.requiresUserScope() === true;
const userOnly = present(aiIds.find(requiresUser));
const projectOnly = present(aiIds.find((id) => !requiresUser(id)));

function planner(installed: Manifest | null = null): PlanPluginInstall {
  return new PlanPluginInstall(new InMemoryManifestRepository(installed), tools);
}

describe("PlanPluginInstall", () => {
  it("accepts the scope each named tool supports", async () => {
    await expect(
      planner().execute({ toolIds: [projectOnly], scope: "project" })
    ).resolves.toBeUndefined();
    await expect(
      planner().execute({ toolIds: [userOnly], scope: "user" })
    ).resolves.toBeUndefined();
  });

  it("refuses a project install for a tool that only supports the user scope", async () => {
    await expect(
      planner().execute({ toolIds: [userOnly], scope: "project" })
    ).rejects.toBeInstanceOf(InvalidPluginScopeError);
  });

  it("refuses a user install for a tool that only supports the project scope", async () => {
    await expect(
      planner().execute({ toolIds: [projectOnly], scope: "user" })
    ).rejects.toBeInstanceOf(InvalidPluginScopeError);
  });

  it("checks every AI tool when none is named and no tool is installed", async () => {
    await expect(planner().execute({ toolIds: "all", scope: "project" })).rejects.toBeInstanceOf(
      InvalidPluginScopeError
    );
  });

  it("checks only the installed tools when none is named", async () => {
    const manifest = Manifest.create();
    manifest.addTool(projectOnly, "test", []);

    await expect(
      planner(manifest).execute({ toolIds: "all", scope: "project" })
    ).resolves.toBeUndefined();
  });
});
