import { describe, expect, it, vi } from "vitest";
import { InputRequiredError } from "../../../../src/application/errors.js";
import { SetupMarketplaceSourceUseCase } from "../../../../src/application/use-cases/setup/setup-marketplace-source-use-case.js";
import {
  DEFAULT_FRAMEWORK_REPO,
  MarketplaceSourceMode,
} from "../../../../src/domain/models/marketplace-source-mode.js";
import type { LatestReleaseResolver } from "../../../../src/domain/ports/latest-release-resolver.js";
import { ScriptedPrompter } from "../../../helpers/ports/scripted-prompter.js";

function makeResolver(tag: string | null): LatestReleaseResolver {
  return { resolveLatest: vi.fn().mockResolvedValue(tag) };
}

const PROJECT_ROOT = "/test-project";

describe("SetupMarketplaceSourceUseCase", () => {
  describe("--release flag path (ref pre-supplied)", () => {
    it("returns source unchanged when ref is already set", async () => {
      const resolver = makeResolver("v9.9.9");
      const prompter = new ScriptedPrompter([]);
      const uc = new SetupMarketplaceSourceUseCase(prompter, resolver);

      const source = MarketplaceSourceMode.remote(undefined, "v1.0.0");
      const result = await uc.execute({
        projectRoot: PROJECT_ROOT,
        sourceFromCli: source,
        interactive: false,
      });

      expect(result.ref).toBe("v1.0.0");
      expect(resolver.resolveLatest).not.toHaveBeenCalled();
    });

    it("local source is returned unchanged (no release resolution)", async () => {
      const resolver = makeResolver("v1.0.0");
      const prompter = new ScriptedPrompter([]);
      const uc = new SetupMarketplaceSourceUseCase(prompter, resolver);

      const source = MarketplaceSourceMode.local("/abs/path");
      const result = await uc.execute({
        projectRoot: PROJECT_ROOT,
        sourceFromCli: source,
        interactive: false,
      });

      expect(result.kind).toBe("local");
      expect(resolver.resolveLatest).not.toHaveBeenCalled();
    });
  });

  describe("non-interactive auto-resolve path", () => {
    it("resolves latest tag and stores it in ref when no ref given", async () => {
      const resolver = makeResolver("v2.3.4");
      const prompter = new ScriptedPrompter([]);
      const uc = new SetupMarketplaceSourceUseCase(prompter, resolver);

      const source = MarketplaceSourceMode.remote();
      const result = await uc.execute({
        projectRoot: PROJECT_ROOT,
        sourceFromCli: source,
        interactive: false,
      });

      expect(result.ref).toBe("v2.3.4");
      expect(resolver.resolveLatest).toHaveBeenCalledWith(DEFAULT_FRAMEWORK_REPO);
    });

    it("falls back to HEAD (undefined ref) when no releases exist", async () => {
      const resolver = makeResolver(null);
      const prompter = new ScriptedPrompter([]);
      const uc = new SetupMarketplaceSourceUseCase(prompter, resolver);

      const source = MarketplaceSourceMode.remote();
      const result = await uc.execute({
        projectRoot: PROJECT_ROOT,
        sourceFromCli: source,
        interactive: false,
      });

      expect(result.ref).toBeUndefined();
    });

    it("throws InputRequiredError when no source given and non-interactive", async () => {
      const resolver = makeResolver(null);
      const prompter = new ScriptedPrompter([]);
      const uc = new SetupMarketplaceSourceUseCase(prompter, resolver);

      await expect(uc.execute({ projectRoot: PROJECT_ROOT, interactive: false })).rejects.toThrow(
        InputRequiredError
      );
    });
  });

  describe("interactive prompt path", () => {
    it("prompts source kind and version, uses default tag when user presses enter", async () => {
      const resolver = makeResolver("v3.0.0");
      const prompter = new ScriptedPrompter([
        ScriptedPrompter.answer.select("remote"),
        ScriptedPrompter.answer.input("v3.0.0"),
      ]);
      const uc = new SetupMarketplaceSourceUseCase(prompter, resolver);

      const result = await uc.execute({ projectRoot: PROJECT_ROOT, interactive: true });

      expect(result.kind).toBe("remote");
      expect(result.ref).toBe("v3.0.0");
    });

    it("stores user-typed ref when user enters a different tag", async () => {
      const resolver = makeResolver("v3.0.0");
      const prompter = new ScriptedPrompter([
        ScriptedPrompter.answer.select("remote"),
        ScriptedPrompter.answer.input("v1.0.0"),
      ]);
      const uc = new SetupMarketplaceSourceUseCase(prompter, resolver);

      const result = await uc.execute({ projectRoot: PROJECT_ROOT, interactive: true });

      expect(result.ref).toBe("v1.0.0");
    });

    it("uses undefined ref when user enters empty string and no releases exist", async () => {
      const resolver = makeResolver(null);
      const prompter = new ScriptedPrompter([
        ScriptedPrompter.answer.select("remote"),
        ScriptedPrompter.answer.input(""),
      ]);
      const uc = new SetupMarketplaceSourceUseCase(prompter, resolver);

      const result = await uc.execute({ projectRoot: PROJECT_ROOT, interactive: true });

      expect(result.kind).toBe("remote");
      expect(result.ref).toBeUndefined();
    });

    it("prompts for local path when user selects local", async () => {
      const resolver = makeResolver(null);
      const prompter = new ScriptedPrompter([
        ScriptedPrompter.answer.select("local"),
        ScriptedPrompter.answer.input("/abs/framework"),
      ]);
      const uc = new SetupMarketplaceSourceUseCase(prompter, resolver);

      const result = await uc.execute({ projectRoot: PROJECT_ROOT, interactive: true });

      expect(result.kind).toBe("local");
      expect(result.path).toBe("/abs/framework");
    });
  });

  describe("interactive with sourceFromCli (ref not set)", () => {
    it("prompts for version when interactive and no ref supplied", async () => {
      const resolver = makeResolver("v4.0.0");
      const prompter = new ScriptedPrompter([ScriptedPrompter.answer.input("v4.0.0")]);
      const uc = new SetupMarketplaceSourceUseCase(prompter, resolver);

      const source = MarketplaceSourceMode.remote();
      const result = await uc.execute({
        projectRoot: PROJECT_ROOT,
        sourceFromCli: source,
        interactive: true,
      });

      expect(result.ref).toBe("v4.0.0");
    });
  });
});
