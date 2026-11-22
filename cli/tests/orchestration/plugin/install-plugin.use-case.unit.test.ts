import { describe, expect, it, vi } from "vitest";
import type { MarketplaceTrustStore } from "../../../src/contexts/distribution/ports/marketplace-trust-store.js";
import { InvalidPluginScopeError } from "../../../src/contexts/installation/domain/installation.error.js";
import {
  InteractiveOnlyError,
  TrustDeniedError,
} from "../../../src/orchestration/orchestration.error.js";
import type { Prompter } from "../../../src/orchestration/ports/prompter.js";
import {
  SYNTHETIC_NATIVE_TOOL,
  SYNTHETIC_USER_TOOL,
  syntheticNativeFamilyCatalog,
} from "../../shared/testing/synthetic-native-tool.builder.js";
import {
  makeUseCase,
  manifestWith,
  PLUGIN_FIXTURE,
  PROJECT_ROOT,
} from "../testing/install-plugin.builder.js";

describe("installing a plugin", () => {
  describe("no-arg routing", () => {
    it("delegates to PickPlugins when no arg and interactive", async () => {
      const pickExecute = vi
        .fn()
        .mockResolvedValue({ marketplace: { name: "m" }, installed: ["p1"] });

      const result = await makeUseCase({
        tools: syntheticNativeFamilyCatalog(),
        pickExecute,
      }).execute({
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
      await expect(
        makeUseCase({ tools: syntheticNativeFamilyCatalog() }).execute({
          pluginArg: undefined,
          toolIds: "all",
          projectRoot: PROJECT_ROOT,
          interactive: false,
        })
      ).rejects.toBeInstanceOf(InteractiveOnlyError);
    });
  });

  describe("scope validation", () => {
    it("rejects --scope user for a project-scope tool", async () => {
      await expect(
        makeUseCase({ tools: syntheticNativeFamilyCatalog() }).execute({
          pluginArg: "my-plugin",
          toolIds: [SYNTHETIC_NATIVE_TOOL],
          projectRoot: PROJECT_ROOT,
          interactive: false,
          scope: "user",
        })
      ).rejects.toBeInstanceOf(InvalidPluginScopeError);
    });

    it("rejects --scope project for a user-scope tool", async () => {
      await expect(
        makeUseCase({ tools: syntheticNativeFamilyCatalog() }).execute({
          pluginArg: "my-plugin",
          toolIds: [SYNTHETIC_USER_TOOL],
          projectRoot: PROJECT_ROOT,
          interactive: false,
          scope: "project",
        })
      ).rejects.toBeInstanceOf(InvalidPluginScopeError);
    });

    it("accepts --scope user for a user-scope tool (matches tool's supported scope)", async () => {
      const marketplaceExecute = vi.fn().mockResolvedValue({ entry: { name: "my-plugin" } });
      const result = await makeUseCase({
        tools: syntheticNativeFamilyCatalog(),
        marketplaceExecute,
      }).execute({
        pluginArg: "my-plugin",
        toolIds: [SYNTHETIC_USER_TOOL],
        projectRoot: PROJECT_ROOT,
        interactive: false,
        scope: "user",
      });
      expect(result.kind).toBe("marketplace");
    });

    it("accepts --scope project for a project-scope tool (matches default supported scope)", async () => {
      const marketplaceExecute = vi.fn().mockResolvedValue({ entry: { name: "my-plugin" } });
      const result = await makeUseCase({
        tools: syntheticNativeFamilyCatalog(),
        marketplaceExecute,
      }).execute({
        pluginArg: "my-plugin",
        toolIds: [SYNTHETIC_NATIVE_TOOL],
        projectRoot: PROJECT_ROOT,
        interactive: false,
        scope: "project",
      });
      expect(result.kind).toBe("marketplace");
    });
  });

  describe("source arg routing", () => {
    it("delegates to AddPlugin when arg is an absolute local path", async () => {
      const addExecute = vi.fn().mockResolvedValue(undefined);

      const result = await makeUseCase({
        tools: syntheticNativeFamilyCatalog(),
        addExecute,
      }).execute({
        pluginArg: PLUGIN_FIXTURE,
        toolIds: "all",
        projectRoot: PROJECT_ROOT,
        interactive: false,
      });

      expect(addExecute).toHaveBeenCalledOnce();
      expect(result.kind).toBe("local");
    });

    it("delegates to PluginInstallFromMarketplace when arg is a plugin name", async () => {
      const marketplaceExecute = vi.fn().mockResolvedValue({ entry: { name: "my-plugin" } });

      const result = await makeUseCase({
        tools: syntheticNativeFamilyCatalog(),
        marketplaceExecute,
      }).execute({
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

  describe("direct-source trust gate", () => {
    it("throws TrustDeniedError and blocks install when trust is denied", async () => {
      const addExecute = vi.fn();
      const denyingTrustStore: MarketplaceTrustStore = {
        isTrusted: vi.fn().mockResolvedValue(false),
        trust: vi.fn().mockResolvedValue(undefined),
      };
      const denyingPrompter: Prompter = {
        confirm: vi.fn().mockResolvedValue(false),
        input: vi.fn(),
        select: vi.fn(),
        checkbox: vi.fn(),
        resolveConflict: vi.fn(),
        resolveConflictBulk: vi.fn(),
      };

      await expect(
        makeUseCase({
          tools: syntheticNativeFamilyCatalog(),
          addExecute,
          trustStore: denyingTrustStore,
          prompter: denyingPrompter,
        }).execute({
          pluginArg: PLUGIN_FIXTURE,
          toolIds: "all",
          projectRoot: PROJECT_ROOT,
          interactive: true,
        })
      ).rejects.toBeInstanceOf(TrustDeniedError);

      expect(addExecute).not.toHaveBeenCalled();
    });

    it("calls install after trust is granted via prompter", async () => {
      const addExecute = vi.fn().mockResolvedValue(undefined);
      const grantingTrustStore: MarketplaceTrustStore = {
        isTrusted: vi.fn().mockResolvedValue(false),
        trust: vi.fn().mockResolvedValue(undefined),
      };
      const grantingPrompter: Prompter = {
        confirm: vi.fn().mockResolvedValue(true),
        input: vi.fn(),
        select: vi.fn(),
        checkbox: vi.fn(),
        resolveConflict: vi.fn(),
        resolveConflictBulk: vi.fn(),
      };

      const result = await makeUseCase({
        tools: syntheticNativeFamilyCatalog(),
        addExecute,
        trustStore: grantingTrustStore,
        prompter: grantingPrompter,
      }).execute({
        pluginArg: PLUGIN_FIXTURE,
        toolIds: "all",
        projectRoot: PROJECT_ROOT,
        interactive: true,
      });

      expect(addExecute).toHaveBeenCalledOnce();
      expect(result.kind).toBe("local");
    });

    it("does not invoke the trust gate for marketplace installs", async () => {
      const marketplaceExecute = vi.fn().mockResolvedValue({ entry: { name: "my-plugin" } });
      const trustStore: MarketplaceTrustStore = {
        isTrusted: vi.fn().mockResolvedValue(false),
        trust: vi.fn().mockResolvedValue(undefined),
      };

      await makeUseCase({
        tools: syntheticNativeFamilyCatalog(),
        marketplaceExecute,
        trustStore,
      }).execute({
        pluginArg: "my-plugin",
        toolIds: "all",
        projectRoot: PROJECT_ROOT,
        interactive: false,
      });

      expect(trustStore.isTrusted).not.toHaveBeenCalled();
    });
  });

  describe("scope validation against every targeted tool", () => {
    const marketplaceExecute = () => vi.fn().mockResolvedValue({ entry: { name: "my-plugin" } });

    it("checks every AI tool when no manifest exists", async () => {
      await expect(
        makeUseCase({
          tools: syntheticNativeFamilyCatalog(),
          marketplaceExecute: marketplaceExecute(),
        }).execute({
          pluginArg: "my-plugin",
          toolIds: "all",
          projectRoot: PROJECT_ROOT,
          interactive: false,
          scope: "project",
        })
      ).rejects.toBeInstanceOf(InvalidPluginScopeError);
    });

    it("checks only the installed tools when a manifest exists", async () => {
      const result = await makeUseCase({
        tools: syntheticNativeFamilyCatalog(),
        marketplaceExecute: marketplaceExecute(),
        manifestRepo: manifestWith(SYNTHETIC_NATIVE_TOOL),
      }).execute({
        pluginArg: "my-plugin",
        toolIds: "all",
        projectRoot: PROJECT_ROOT,
        interactive: false,
        scope: "project",
      });

      expect(result.kind).toBe("marketplace");
    });

    it("rejects a scope an installed tool refuses", async () => {
      await expect(
        makeUseCase({
          tools: syntheticNativeFamilyCatalog(),
          marketplaceExecute: marketplaceExecute(),
          manifestRepo: manifestWith(SYNTHETIC_NATIVE_TOOL),
        }).execute({
          pluginArg: "my-plugin",
          toolIds: "all",
          projectRoot: PROJECT_ROOT,
          interactive: false,
          scope: "user",
        })
      ).rejects.toBeInstanceOf(InvalidPluginScopeError);
    });
  });

  describe("source argument shapes", () => {
    it("routes a URL argument to the local-source add", async () => {
      const addExecute = vi.fn().mockResolvedValue(undefined);

      const result = await makeUseCase({
        tools: syntheticNativeFamilyCatalog(),
        addExecute,
      }).execute({
        pluginArg: "https://github.com/x/y.git",
        toolIds: "all",
        projectRoot: PROJECT_ROOT,
        interactive: false,
      });

      expect(result).toStrictEqual({ kind: "local", installed: [] });
    });

    it("routes a relative ./ path to the local-source add", async () => {
      const addExecute = vi.fn().mockResolvedValue(undefined);

      const result = await makeUseCase({
        tools: syntheticNativeFamilyCatalog(),
        addExecute,
      }).execute({
        pluginArg: "./plugins/mine",
        toolIds: "all",
        projectRoot: PROJECT_ROOT,
        interactive: false,
      });

      expect(result).toStrictEqual({ kind: "local", installed: [] });
    });
  });
});
