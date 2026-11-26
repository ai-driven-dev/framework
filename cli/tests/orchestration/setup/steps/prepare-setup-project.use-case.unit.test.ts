import { describe, expect, it, vi } from "vitest";
import {
  type FrameworkSource,
  localFrameworkSource,
} from "../../../../src/contexts/distribution/contract/framework-source.js";
import { ProjectContext } from "../../../../src/contexts/installation/contract/project-context.js";
import { Manifest } from "../../../../src/contexts/installation/domain/manifest.js";
import { SetupFlow } from "../../../../src/orchestration/setup/setup-flow.model.js";
import { PrepareSetupProject } from "../../../../src/orchestration/setup/steps/prepare-setup-project.use-case.js";
import { syntheticFlowTools } from "../../../shared/testing/synthetic-tool-id.builder.js";

const flow = new SetupFlow({
  ...syntheticFlowTools(),
  supportsUserScopeActivation: () => true,
  projectRoot: "/project",
  interactive: false,
});

function prepareOver(parts: { initialized?: boolean; withDetector?: boolean } = {}) {
  const calls: string[] = [];
  const context = new ProjectContext({ stack: "unknown", isMonorepo: false, hasFramework: false });
  const detect = vi.fn(async () => {
    calls.push("detect");
    return context;
  });
  const resolveSource = vi.fn(async (): Promise<FrameworkSource | null> => {
    calls.push("resolve");
    return null;
  });
  // Recorded as "init" only when asked to leave an existing manifest alone.
  const initialize = vi.fn(async (request: { readonly ifAbsent?: boolean }) => {
    calls.push(request.ifAbsent === true ? "init" : "init-or-refuse");
    return { manifest: Manifest.create(), created: parts.initialized ?? true };
  });
  const register = vi.fn(async () => {
    calls.push("register");
  });
  const prepare = new PrepareSetupProject(
    parts.withDetector === false ? undefined : { execute: detect },
    { execute: resolveSource },
    { execute: initialize },
    register
  );
  return { prepare, calls, context, resolveSource, register, initialize };
}

describe("preparing a setup project", () => {
  describe("when a project is set up", () => {
    it("detects, resolves the source, initializes, then registers, in that order", async () => {
      const { prepare, calls } = prepareOver();

      await prepare.execute(flow);

      expect(calls).toStrictEqual(["detect", "resolve", "init", "register"]);
    });

    it("hands the resolved source to the registration", async () => {
      const { prepare, resolveSource, register } = prepareOver();
      const source = localFrameworkSource("/framework");
      resolveSource.mockResolvedValue(source);

      await prepare.execute(flow);

      expect(register).toHaveBeenCalledWith(flow, source);
    });
  });

  describe("when the project already holds a manifest", () => {
    it("reports it as not new", async () => {
      const { prepare } = prepareOver({ initialized: false });

      expect((await prepare.execute(flow)).isNew).toBe(false);
    });

    it("reports a project it just initialized as new, with what it detected", async () => {
      const { prepare, context } = prepareOver({ initialized: true });

      expect(await prepare.execute(flow)).toStrictEqual({ context, isNew: true });
    });
  });

  describe("when no detection is wired", () => {
    it("carries no context", async () => {
      const { prepare } = prepareOver({ withDetector: false });

      expect((await prepare.execute(flow)).context).toBeUndefined();
    });
  });
});
