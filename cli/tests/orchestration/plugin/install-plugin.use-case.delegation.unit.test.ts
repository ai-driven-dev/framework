import { describe, expect, it, vi } from "vitest";
import type { MarketplaceTrustStore } from "../../../src/contexts/distribution/ports/marketplace-trust-store.js";
import { SYNTHETIC_TOOL } from "../../shared/testing/synthetic-tool-id.builder.js";
import {
  makeAlwaysTrustStore,
  makeSilentPrompter,
  makeUseCase,
  PLUGIN_FIXTURE,
  PROJECT_ROOT,
} from "../testing/install-plugin.builder.js";

describe("InstallPlugin: what it delegates", () => {
  describe("what each delegate receives", () => {
    it("names the action when refusing a non-interactive pick", async () => {
      await expect(
        makeUseCase().execute({
          pluginArg: undefined,
          toolIds: "all",
          projectRoot: PROJECT_ROOT,
          interactive: false,
        })
      ).rejects.toThrow(expect.objectContaining({ action: "plugin install" }));
    });

    it("hands the pick its tools, project and an interactive flag", async () => {
      const pickExecute = vi.fn().mockResolvedValue({ installed: [] });

      await makeUseCase({ pickExecute }).execute({
        pluginArg: undefined,
        toolIds: [SYNTHETIC_TOOL],
        projectRoot: PROJECT_ROOT,
        interactive: true,
      });

      expect(pickExecute).toHaveBeenCalledWith({
        toolIds: ["synthetic"],
        projectRoot: PROJECT_ROOT,
        interactive: true,
      });
    });

    it("hands the add the parsed source and the caller's options", async () => {
      const addExecute = vi.fn().mockResolvedValue(undefined);

      const result = await makeUseCase({ addExecute }).execute({
        pluginArg: PLUGIN_FIXTURE,
        toolIds: [SYNTHETIC_TOOL],
        projectRoot: PROJECT_ROOT,
        interactive: false,
      });

      expect(addExecute).toHaveBeenCalledWith({
        source: { kind: "local", path: PLUGIN_FIXTURE },
        toolIds: ["synthetic"],
        projectRoot: PROJECT_ROOT,
        interactive: false,
        githubMarketplace: false,
      });
      expect(result).toStrictEqual({ kind: "local", installed: [] });
    });

    it("hands the marketplace install the parsed name, version and options", async () => {
      const marketplaceExecute = vi.fn().mockResolvedValue({ entry: { name: "my-plugin" } });

      await makeUseCase({ marketplaceExecute }).execute({
        pluginArg: "my-plugin@1.2.3",
        toolIds: [SYNTHETIC_TOOL],
        projectRoot: PROJECT_ROOT,
        interactive: false,
        fromMarketplace: "mkt",
        yes: true,
      });

      expect(marketplaceExecute).toHaveBeenCalledWith({
        pluginName: "my-plugin",
        version: "1.2.3",
        fromMarketplace: "mkt",
        toolIds: ["synthetic"],
        projectRoot: PROJECT_ROOT,
        interactive: false,
        autoSelect: true,
      });
    });

    it("defaults autoSelect to false when --yes is absent", async () => {
      const marketplaceExecute = vi.fn().mockResolvedValue({ entry: { name: "my-plugin" } });

      await makeUseCase({ marketplaceExecute }).execute({
        pluginArg: "my-plugin",
        toolIds: [SYNTHETIC_TOOL],
        projectRoot: PROJECT_ROOT,
        interactive: false,
      });

      expect(marketplaceExecute).toHaveBeenCalledWith({
        pluginName: "my-plugin",
        version: undefined,
        fromMarketplace: undefined,
        toolIds: ["synthetic"],
        projectRoot: PROJECT_ROOT,
        interactive: false,
        autoSelect: false,
      });
    });
  });

  describe("trusting a direct source", () => {
    function untrustedStore(): MarketplaceTrustStore {
      return {
        isTrusted: vi.fn().mockResolvedValue(false),
        trust: vi.fn().mockResolvedValue(undefined),
      };
    }

    it("neither prompts nor records trust for a source already trusted", async () => {
      const trustStore = makeAlwaysTrustStore();
      const prompter = makeSilentPrompter();

      await makeUseCase({ addExecute: vi.fn(), trustStore, prompter }).execute({
        pluginArg: PLUGIN_FIXTURE,
        toolIds: "all",
        projectRoot: PROJECT_ROOT,
        interactive: true,
      });

      expect(prompter.confirm).not.toHaveBeenCalled();
      expect(trustStore.trust).not.toHaveBeenCalled();
    });

    it("records trust without prompting when --yes is passed", async () => {
      const trustStore = untrustedStore();
      const prompter = makeSilentPrompter();

      await makeUseCase({ addExecute: vi.fn(), trustStore, prompter }).execute({
        pluginArg: PLUGIN_FIXTURE,
        toolIds: "all",
        projectRoot: PROJECT_ROOT,
        interactive: false,
        yes: true,
      });

      expect(prompter.confirm).not.toHaveBeenCalled();
      expect(trustStore.trust).toHaveBeenCalledWith(PROJECT_ROOT, {
        kind: "local",
        path: PLUGIN_FIXTURE,
      });
    });

    it("asks to trust the source by its description", async () => {
      const prompter = makeSilentPrompter();

      await makeUseCase({ addExecute: vi.fn(), trustStore: untrustedStore(), prompter }).execute({
        pluginArg: PLUGIN_FIXTURE,
        toolIds: "all",
        projectRoot: PROJECT_ROOT,
        interactive: true,
      });

      expect(prompter.confirm).toHaveBeenCalledWith(`Trust plugin source '${PLUGIN_FIXTURE}'?`);
    });
  });
});
