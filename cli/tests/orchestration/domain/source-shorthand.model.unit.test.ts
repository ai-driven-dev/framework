import { describe, expect, it } from "vitest";
import { parsePluginSourceShorthand } from "../../../src/orchestration/domain/source-shorthand.model.js";
import { InvalidPluginSourceError } from "../../../src/shared/domain/shared.error.js";
import { saying } from "../../shared/testing/saying.builder.js";

/**
 * Grouped by what a user types, not by the parsing function: the wrong kind sends the plugin
 * to the wrong fetch adapter, and a dropped ref installs the default branch — both silently.
 */
describe("the source spellings a user types", () => {
  describe("a bare owner/repo", () => {
    it("resolves to a github source with no ref", () => {
      expect(parsePluginSourceShorthand("ai-driven-dev/framework")).toEqual({
        kind: "github",
        repo: "ai-driven-dev/framework",
      });
    });

    it("is not mistaken for a path when it contains dots or dashes", () => {
      expect(parsePluginSourceShorthand("my-org/my.plugin_v2")).toEqual({
        kind: "github",
        repo: "my-org/my.plugin_v2",
      });
    });
  });

  describe("a pinned version, owner/repo@ref", () => {
    it("keeps the ref and strips it from the repo", () => {
      expect(parsePluginSourceShorthand("ai-driven-dev/framework@v1.2.0")).toEqual({
        kind: "github",
        repo: "ai-driven-dev/framework",
        ref: "v1.2.0",
      });
    });

    it("splits on the last @, so a ref containing one is refused rather than mangled", () => {
      // The repo half would be "owner/repo@release", not owner/repo, so the spelling falls
      // through to the JSON branch and is rejected rather than installing a mangled name.
      expect(() => parsePluginSourceShorthand("owner/repo@release@2")).toThrow(
        new InvalidPluginSourceError('unrecognized source format: "owner/repo@release@2"')
      );
    });

    it("refuses a spelling whose repo half is not owner/repo", () => {
      expect(() => parsePluginSourceShorthand("not-a-repo@v1")).toThrow(
        new InvalidPluginSourceError('unrecognized source format: "not-a-repo@v1"')
      );
    });

    it("does not read a spelling with no @ as a repo missing its last character", () => {
      expect(() => parsePluginSourceShorthand("owner/repo!")).toThrow(
        new InvalidPluginSourceError('unrecognized source format: "owner/repo!"')
      );
    });

    it("treats a leading @ as part of an unrecognized spelling, not a separator", () => {
      expect(() => parsePluginSourceShorthand("@v1.2.0")).toThrow(
        new InvalidPluginSourceError('unrecognized source format: "@v1.2.0"')
      );
    });
  });

  describe("a gitlab: shorthand", () => {
    it("resolves gitlab:owner/repo to a gitlab.com git URL", () => {
      expect(parsePluginSourceShorthand("gitlab:my-org/my-plugin")).toStrictEqual({
        kind: "url",
        url: "https://gitlab.com/my-org/my-plugin.git",
      });
    });

    it("carries a ref through when one is given", () => {
      expect(parsePluginSourceShorthand("gitlab:my-org/my-plugin@v2")).toStrictEqual({
        kind: "url",
        url: "https://gitlab.com/my-org/my-plugin.git",
        ref: "v2",
      });
    });

    it("says what the spelling should have looked like when it is malformed", () => {
      expect(() => parsePluginSourceShorthand("gitlab:nope")).toThrow(
        saying(/gitlab:owner\/repo or gitlab:owner\/repo@ref/)
      );
    });
  });

  describe("a URL", () => {
    it("keeps an https URL as a url source", () => {
      expect(parsePluginSourceShorthand("https://example.com/p.git")).toEqual({
        kind: "url",
        url: "https://example.com/p.git",
      });
    });

    it("keeps an http URL as a url source", () => {
      expect(parsePluginSourceShorthand("http://example.com/p.git")).toEqual({
        kind: "url",
        url: "http://example.com/p.git",
      });
    });

    it("keeps an SSH URL as a url source", () => {
      expect(parsePluginSourceShorthand("git@github.com:owner/repo.git")).toEqual({
        kind: "url",
        url: "git@github.com:owner/repo.git",
      });
    });
  });

  describe("a path on this machine", () => {
    it("resolves a relative path to a local source", () => {
      expect(parsePluginSourceShorthand("./plugins/mine")).toEqual({
        kind: "local",
        path: "./plugins/mine",
      });
    });

    it("resolves an absolute path to a local source", () => {
      expect(parsePluginSourceShorthand("/opt/plugins/mine")).toEqual({
        kind: "local",
        path: "/opt/plugins/mine",
      });
    });
  });

  describe("raw JSON, for the sources no shorthand covers", () => {
    it("parses a JSON object into the source it describes", () => {
      expect(
        parsePluginSourceShorthand('{"kind":"npm","package":"@scope/pkg","version":"1.0.0"}')
      ).toEqual({ kind: "npm", package: "@scope/pkg", version: "1.0.0" });
    });

    it("reports the JSON's own complaint when the object is a bad source", () => {
      // Both branches throw InvalidPluginSourceError, so asserting the class alone would
      // pass even with the parser's own message swallowed by the generic one.
      expect(() => parsePluginSourceShorthand('{"kind":"github"}')).toThrow(
        saying(/"repo" must be a non-empty string/)
      );
    });

    it("names the string it was given when nothing recognizes it", () => {
      expect(() => parsePluginSourceShorthand("just some words")).toThrow(
        saying(/unrecognized source format: "just some words"/)
      );
    });
  });
});
