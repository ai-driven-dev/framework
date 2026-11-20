import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_FRAMEWORK_REPO,
  localFrameworkSource,
  remoteFrameworkSource,
} from "../../../src/contexts/distribution/contract/framework-source.js";
import type { RepositoryVisibility } from "../../../src/contexts/distribution/ports/repository-visibility.js";
import { InputRequiredError } from "../../../src/shared/domain/errors.js";
import type { ReleaseLister } from "../../../src/shared/ports/release-lister.js";
import { ScriptedPrompter } from "../../shared/testing/scripted-prompter.fake.js";
import { askMarketplaceSource } from "../testing/ask-marketplace-source.js";

function makeResolver(rootReleases: string[]): ReleaseLister & RepositoryVisibility {
  return {
    listReleaseTags: vi.fn().mockResolvedValue(rootReleases),
    readReleaseBody: vi.fn().mockResolvedValue(null),
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
        sourceFromCli: remoteFrameworkSource(),
        interactive: false,
      });

      expect(result).toMatchObject({ ref: "v2.3.4" });
      expect(resolver.listReleaseTags).toHaveBeenCalledWith(DEFAULT_FRAMEWORK_REPO);
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

      expect(result).toMatchObject({ kind: "github", ref: "v2.9.0" });
    });

    it("maps the HEAD choice to an undefined ref", async () => {
      const resolver = makeResolver(["v3.0.0"]);
      const prompter = new ScriptedPrompter([
        ScriptedPrompter.answer.select("remote"),
        ScriptedPrompter.answer.select("__HEAD__"),
      ]);
      const uc = askMarketplaceSource(prompter, resolver);

      const result = await uc.execute({ projectRoot: PROJECT_ROOT, interactive: true });

      expect(result).toMatchObject({ kind: "github" });
      expect(result).not.toHaveProperty("ref", expect.any(String));
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
      expect(result).toMatchObject({ path: resolve("/abs/framework") });
    });
  });

  describe("interactive with sourceFromCli (ref not set)", () => {
    it("shows the release picker when interactive and no ref supplied", async () => {
      const resolver = makeResolver(["v4.0.0"]);
      const prompter = new ScriptedPrompter([ScriptedPrompter.answer.select("v4.0.0")]);
      const uc = askMarketplaceSource(prompter, resolver);

      const result = await uc.execute({
        projectRoot: PROJECT_ROOT,
        sourceFromCli: remoteFrameworkSource(),
        interactive: true,
      });

      expect(result).toMatchObject({ ref: "v4.0.0" });
    });

    it("pins an older release the user picks rather than the newest", async () => {
      const resolver = makeResolver(["v4.0.0", "v3.0.0"]);
      const prompter = new ScriptedPrompter([ScriptedPrompter.answer.select("v3.0.0")]);
      const uc = askMarketplaceSource(prompter, resolver);

      const result = await uc.execute({
        projectRoot: PROJECT_ROOT,
        sourceFromCli: remoteFrameworkSource(),
        interactive: true,
      });

      expect(result).toMatchObject({ ref: "v3.0.0" });
    });

    it("asks nothing when the command line already names the ref", async () => {
      const resolver = makeResolver(["v4.0.0"]);
      const uc = askMarketplaceSource(new ScriptedPrompter([]), resolver);

      const result = await uc.execute({
        projectRoot: PROJECT_ROOT,
        sourceFromCli: remoteFrameworkSource(undefined, "v1.2.3"),
        interactive: true,
      });

      expect(result).toMatchObject({ ref: "v1.2.3" });
      expect(resolver.listReleaseTags).not.toHaveBeenCalled();
    });

    it("asks nothing when the command line names a local source", async () => {
      const resolver = makeResolver(["v4.0.0"]);
      const uc = askMarketplaceSource(new ScriptedPrompter([]), resolver);

      const result = await uc.execute({
        projectRoot: PROJECT_ROOT,
        sourceFromCli: localFrameworkSource("/abs/framework"),
        interactive: true,
      });

      expect(result).toMatchObject({ kind: "local" });
    });
  });
});
