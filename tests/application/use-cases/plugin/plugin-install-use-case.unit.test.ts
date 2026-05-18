import "../../../../src/domain/tools/ai/claude.js";
import "../../../../src/domain/tools/ai/cursor.js";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { PluginAddUseCase } from "../../../../src/application/use-cases/plugin/plugin-add-use-case.js";
import type { PluginInstallFromMarketplaceUseCase } from "../../../../src/application/use-cases/plugin/plugin-install-from-marketplace-use-case.js";
import { PluginInstallUseCase } from "../../../../src/application/use-cases/plugin/plugin-install-use-case.js";
import type { PluginPickUseCase } from "../../../../src/application/use-cases/plugin/plugin-pick-use-case.js";
import { InteractiveOnlyError, InvalidPluginScopeError } from "../../../../src/domain/errors.js";
import { InMemoryManifestRepository } from "../../../helpers/ports/in-memory-manifest-repository.js";

const PLUGIN_FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");
const PROJECT_ROOT = "/test-project";

function makeUseCases(overrides?: {
  pickExecute?: ReturnType<typeof vi.fn>;
  addExecute?: ReturnType<typeof vi.fn>;
  marketplaceExecute?: ReturnType<typeof vi.fn>;
}) {
  const pickExecute = overrides?.pickExecute ?? vi.fn();
  const addExecute = overrides?.addExecute ?? vi.fn();
  const marketplaceExecute = overrides?.marketplaceExecute ?? vi.fn();
  const pluginPickUseCase = { execute: pickExecute } as unknown as PluginPickUseCase;
  const pluginAddUseCase = { execute: addExecute } as unknown as PluginAddUseCase;
  const pluginInstallFromMarketplaceUseCase = {
    execute: marketplaceExecute,
  } as unknown as PluginInstallFromMarketplaceUseCase;
  const manifestRepo = new InMemoryManifestRepository();
  return {
    pluginPickUseCase,
    pluginAddUseCase,
    pluginInstallFromMarketplaceUseCase,
    manifestRepo,
    pickExecute,
    addExecute,
    marketplaceExecute,
  };
}

describe("PluginInstallUseCase", () => {
  describe("no-arg routing", () => {
    it("delegates to PluginPickUseCase when no arg and interactive", async () => {
      const pickExecute = vi
        .fn()
        .mockResolvedValue({ marketplace: { name: "m" }, installed: ["p1"] });
      const {
        pluginPickUseCase,
        pluginAddUseCase,
        pluginInstallFromMarketplaceUseCase,
        manifestRepo,
      } = makeUseCases({ pickExecute });

      const result = await new PluginInstallUseCase(
        pluginPickUseCase,
        pluginAddUseCase,
        pluginInstallFromMarketplaceUseCase,
        manifestRepo
      ).execute({
        pluginArg: undefined,
        toolIds: "all",
        projectRoot: PROJECT_ROOT,
        interactive: true,
      });

      expect(pickExecute).toHaveBeenCalledOnce();
      expect(result.kind).toBe("picked");
      expect(result.installed).toEqual(["p1"]);
    });

    it("throws InteractiveOnlyError when no arg and non-interactive", async () => {
      const {
        pluginPickUseCase,
        pluginAddUseCase,
        pluginInstallFromMarketplaceUseCase,
        manifestRepo,
      } = makeUseCases();

      await expect(
        new PluginInstallUseCase(
          pluginPickUseCase,
          pluginAddUseCase,
          pluginInstallFromMarketplaceUseCase,
          manifestRepo
        ).execute({
          pluginArg: undefined,
          toolIds: "all",
          projectRoot: PROJECT_ROOT,
          interactive: false,
        })
      ).rejects.toBeInstanceOf(InteractiveOnlyError);
    });
  });

  describe("scope validation", () => {
    it("rejects --scope user for a project-scope tool (claude)", async () => {
      const {
        pluginPickUseCase,
        pluginAddUseCase,
        pluginInstallFromMarketplaceUseCase,
        manifestRepo,
      } = makeUseCases();
      await expect(
        new PluginInstallUseCase(
          pluginPickUseCase,
          pluginAddUseCase,
          pluginInstallFromMarketplaceUseCase,
          manifestRepo
        ).execute({
          pluginArg: "my-plugin",
          toolIds: ["claude"],
          projectRoot: PROJECT_ROOT,
          interactive: false,
          scope: "user",
        })
      ).rejects.toBeInstanceOf(InvalidPluginScopeError);
    });

    it("rejects --scope project for a user-scope tool (cursor)", async () => {
      const {
        pluginPickUseCase,
        pluginAddUseCase,
        pluginInstallFromMarketplaceUseCase,
        manifestRepo,
      } = makeUseCases();
      await expect(
        new PluginInstallUseCase(
          pluginPickUseCase,
          pluginAddUseCase,
          pluginInstallFromMarketplaceUseCase,
          manifestRepo
        ).execute({
          pluginArg: "my-plugin",
          toolIds: ["cursor"],
          projectRoot: PROJECT_ROOT,
          interactive: false,
          scope: "project",
        })
      ).rejects.toBeInstanceOf(InvalidPluginScopeError);
    });

    it("accepts --scope user for cursor (matches tool's supported scope)", async () => {
      const marketplaceExecute = vi.fn().mockResolvedValue({ entry: { name: "my-plugin" } });
      const {
        pluginPickUseCase,
        pluginAddUseCase,
        pluginInstallFromMarketplaceUseCase,
        manifestRepo,
      } = makeUseCases({ marketplaceExecute });
      const result = await new PluginInstallUseCase(
        pluginPickUseCase,
        pluginAddUseCase,
        pluginInstallFromMarketplaceUseCase,
        manifestRepo
      ).execute({
        pluginArg: "my-plugin",
        toolIds: ["cursor"],
        projectRoot: PROJECT_ROOT,
        interactive: false,
        scope: "user",
      });
      expect(result.kind).toBe("marketplace");
    });

    it("accepts --scope project for claude (matches default supported scope)", async () => {
      const marketplaceExecute = vi.fn().mockResolvedValue({ entry: { name: "my-plugin" } });
      const {
        pluginPickUseCase,
        pluginAddUseCase,
        pluginInstallFromMarketplaceUseCase,
        manifestRepo,
      } = makeUseCases({ marketplaceExecute });
      const result = await new PluginInstallUseCase(
        pluginPickUseCase,
        pluginAddUseCase,
        pluginInstallFromMarketplaceUseCase,
        manifestRepo
      ).execute({
        pluginArg: "my-plugin",
        toolIds: ["claude"],
        projectRoot: PROJECT_ROOT,
        interactive: false,
        scope: "project",
      });
      expect(result.kind).toBe("marketplace");
    });
  });

  describe("source arg routing", () => {
    it("delegates to PluginAddUseCase when arg is an absolute local path", async () => {
      const addExecute = vi.fn().mockResolvedValue(undefined);
      const {
        pluginPickUseCase,
        pluginAddUseCase,
        pluginInstallFromMarketplaceUseCase,
        manifestRepo,
      } = makeUseCases({ addExecute });

      const result = await new PluginInstallUseCase(
        pluginPickUseCase,
        pluginAddUseCase,
        pluginInstallFromMarketplaceUseCase,
        manifestRepo
      ).execute({
        pluginArg: PLUGIN_FIXTURE,
        toolIds: "all",
        projectRoot: PROJECT_ROOT,
        interactive: false,
      });

      expect(addExecute).toHaveBeenCalledOnce();
      expect(result.kind).toBe("local");
    });

    it("delegates to PluginInstallFromMarketplaceUseCase when arg is a plugin name", async () => {
      const marketplaceExecute = vi.fn().mockResolvedValue({ entry: { name: "my-plugin" } });
      const {
        pluginPickUseCase,
        pluginAddUseCase,
        pluginInstallFromMarketplaceUseCase,
        manifestRepo,
      } = makeUseCases({ marketplaceExecute });

      const result = await new PluginInstallUseCase(
        pluginPickUseCase,
        pluginAddUseCase,
        pluginInstallFromMarketplaceUseCase,
        manifestRepo
      ).execute({
        pluginArg: "my-plugin",
        toolIds: "all",
        projectRoot: PROJECT_ROOT,
        interactive: false,
      });

      expect(marketplaceExecute).toHaveBeenCalledOnce();
      expect(result.kind).toBe("marketplace");
      expect(result.installed).toEqual(["my-plugin"]);
    });
  });
});
