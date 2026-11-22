import { describe, expect, it, vi } from "vitest";
import { ProjectContext } from "../../../../src/contexts/installation/contract/project-context.js";
import { SetupFlow } from "../../../../src/orchestration/domain/setup-flow.model.js";
import { InstallSetupTools } from "../../../../src/orchestration/setup/steps/install-setup-tools.use-case.js";
import {
  SECOND_SYNTHETIC_TOOL,
  SYNTHETIC_TOOL,
  syntheticFlowTools,
} from "../../../shared/testing/synthetic-tool-id.builder.js";

const flow = new SetupFlow({
  ...syntheticFlowTools(),
  supportsUserScopeActivation: () => true,
  projectRoot: "/project",
  aiTools: [SYNTHETIC_TOOL],
  ideTools: [],
  force: true,
  interactive: false,
});

describe("installing the setup tools", () => {
  describe("when nothing asks the person", () => {
    it("installs the tools the flow names, forced and at the current version", async () => {
      const execute = vi.fn().mockResolvedValue("installed");
      const install = new InstallSetupTools({ execute }, undefined, "5.2.2");

      const result = await install.execute({ flow, context: undefined });

      expect(result).toBe("installed");
      expect(execute).toHaveBeenCalledWith({
        projectRoot: "/project",
        aiTools: [SYNTHETIC_TOOL],
        ideTools: [],
        force: true,
        version: "5.2.2",
      });
    });
  });

  describe("when the person picks the tools", () => {
    it("installs the picked tools, asked with the flow's tools and the detected context", async () => {
      const execute = vi.fn().mockResolvedValue("installed");
      const choose = vi.fn().mockResolvedValue({ aiTools: [SECOND_SYNTHETIC_TOOL], ideTools: [] });
      const context = new ProjectContext({
        stack: "unknown",
        isMonorepo: false,
        hasFramework: false,
      });
      const install = new InstallSetupTools({ execute }, { execute: choose }, "5.2.2");

      await install.execute({ flow, context });

      expect(choose).toHaveBeenCalledWith({
        interactive: false,
        aiTools: [SYNTHETIC_TOOL],
        ideTools: [],
        context,
      });
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({ aiTools: [SECOND_SYNTHETIC_TOOL] })
      );
    });
  });
});
