import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_FRAMEWORK_REPO,
  MarketplaceSourceMode,
} from "../../../src/contexts/distribution/domain/marketplace-source-mode.js";
import type { ReleaseLister } from "../../../src/contexts/distribution/ports/release-lister.js";
import type { RepositoryVisibility } from "../../../src/contexts/distribution/ports/repository-visibility.js";
import { InputRequiredError } from "../../../src/shared/domain/errors.js";
import { askMarketplaceSource } from "../../helpers/ask-marketplace-source.js";
import { ScriptedPrompter } from "../../helpers/ports/scripted-prompter.js";

function makeResolver(rootReleases: string[]): ReleaseLister & RepositoryVisibility {
  return {
    listRootReleases: vi.fn().mockResolvedValue(rootReleases),
    isRepoPublic: vi.fn().mockResolvedValue(true),
  };
}

const PROJECT_ROOT = "/test-project";

describe("AskMarketplaceSource", () => {
  describe("non-interactive auto-resolve path", () => {
    it("pins the newest root release when no ref given", async () => {
      const resolver = makeResolver(["v2.3.4", "v2.3.3"]);
      const prompter = new ScriptedPrompter([]);
      const uc = askMarketplaceSource(prompter, resolver);

      const result = await uc.execute({
        projectRoot: PROJECT_ROOT,
        sourceFromCli: MarketplaceSourceMode.remote(),
        interactive: false,
      });

      expect(result.ref).toBe("v2.3.4");
      expect(resolver.listRootReleases).toHaveBeenCalledWith(DEFAULT_FRAMEWORK_REPO);
    });

    it("throws InputRequiredError when no source given and non-interactive", async () => {
      const resolver = makeResolver([]);
      const prompter = new ScriptedPrompter([]);
      const uc = askMarketplaceSource(prompter, resolver);

      await expect(uc.execute({ projectRoot: PROJECT_ROOT, interactive: false })).rejects.toThrow(
        InputRequiredError
      );
    });
  });

  describe("interactive release picker", () => {
    it("pins the release the user selects from the root-release list", async () => {
      const resolver = makeResolver(["v3.0.0", "v2.9.0"]);
      const prompter = new ScriptedPrompter([
        ScriptedPrompter.answer.select("remote"),
        ScriptedPrompter.answer.select("v2.9.0"),
      ]);
      const uc = askMarketplaceSource(prompter, resolver);

      const result = await uc.execute({ projectRoot: PROJECT_ROOT, interactive: true });

      expect(result.kind).toBe("remote");
      expect(result.ref).toBe("v2.9.0");
    });

    it("maps the HEAD choice to an undefined ref", async () => {
      const resolver = makeResolver(["v3.0.0"]);
      const prompter = new ScriptedPrompter([
        ScriptedPrompter.answer.select("remote"),
        ScriptedPrompter.answer.select("__HEAD__"),
      ]);
      const uc = askMarketplaceSource(prompter, resolver);

      const result = await uc.execute({ projectRoot: PROJECT_ROOT, interactive: true });

      expect(result.kind).toBe("remote");
      expect(result.ref).toBeUndefined();
    });

    it("offers only HEAD when the repo has no root releases", async () => {
      const resolver = makeResolver([]);
      const prompter = new ScriptedPrompter([
        ScriptedPrompter.answer.select("remote"),
        ScriptedPrompter.answer.select("__HEAD__"),
      ]);
      const uc = askMarketplaceSource(prompter, resolver);

      const result = await uc.execute({ projectRoot: PROJECT_ROOT, interactive: true });

      expect(result.kind).toBe("remote");
      expect(result.ref).toBeUndefined();
    });

    it("labels the newest release as latest and offers HEAD last", async () => {
      const resolver = makeResolver(["v3.0.0", "v2.9.0"]);
      const prompter = new ScriptedPrompter([
        ScriptedPrompter.answer.select("remote"),
        ScriptedPrompter.answer.select("v2.9.0"),
      ]);
      const uc = askMarketplaceSource(prompter, resolver);

      await uc.execute({ projectRoot: PROJECT_ROOT, interactive: true });

      expect(prompter.askedSelects).toStrictEqual([
        {
          message: "Select framework source:",
          names: [
            "remote (fetch from GitHub marketplace — recommended)",
            "local (copy from local framework directory)",
          ],
        },
        {
          message: "Select framework release to install:",
          names: ["v3.0.0 (latest)", "v2.9.0", "HEAD (main branch tip — unreleased)"],
        },
      ]);
    });

    it("asks for the local path with an empty default", async () => {
      const resolver = makeResolver([]);
      const prompter = new ScriptedPrompter([
        ScriptedPrompter.answer.select("local"),
        ScriptedPrompter.answer.input("/abs/framework"),
      ]);
      const uc = askMarketplaceSource(prompter, resolver);

      await uc.execute({ projectRoot: PROJECT_ROOT, interactive: true });

      expect(prompter.askedInputs).toStrictEqual([
        { message: "Path to local framework directory:", defaultValue: "" },
      ]);
    });

    it("prompts for local path when user selects local", async () => {
      const resolver = makeResolver([]);
      const prompter = new ScriptedPrompter([
        ScriptedPrompter.answer.select("local"),
        ScriptedPrompter.answer.input("/abs/framework"),
      ]);
      const uc = askMarketplaceSource(prompter, resolver);

      const result = await uc.execute({ projectRoot: PROJECT_ROOT, interactive: true });

      expect(result.kind).toBe("local");
      // resolve() fills in the current drive letter on Windows for a rootless absolute path,
      // so the expectation has to be resolved the same way to name the same location.
      expect(result.path).toBe(resolve("/abs/framework"));
    });
  });

  describe("interactive with sourceFromCli (ref not set)", () => {
    it("shows the release picker when interactive and no ref supplied", async () => {
      const resolver = makeResolver(["v4.0.0"]);
      const prompter = new ScriptedPrompter([ScriptedPrompter.answer.select("v4.0.0")]);
      const uc = askMarketplaceSource(prompter, resolver);

      const result = await uc.execute({
        projectRoot: PROJECT_ROOT,
        sourceFromCli: MarketplaceSourceMode.remote(),
        interactive: true,
      });

      expect(result.ref).toBe("v4.0.0");
    });

    it("pins an older release the user picks rather than the newest", async () => {
      const resolver = makeResolver(["v4.0.0", "v3.0.0"]);
      const prompter = new ScriptedPrompter([ScriptedPrompter.answer.select("v3.0.0")]);
      const uc = askMarketplaceSource(prompter, resolver);

      const result = await uc.execute({
        projectRoot: PROJECT_ROOT,
        sourceFromCli: MarketplaceSourceMode.remote(),
        interactive: true,
      });

      expect(result.ref).toBe("v3.0.0");
    });
  });
});
