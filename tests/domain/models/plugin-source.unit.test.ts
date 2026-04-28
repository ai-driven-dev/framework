import { describe, expect, it } from "vitest";
import { InvalidPluginSourceError } from "../../../src/domain/errors.js";
import {
  parsePluginSource,
  serializePluginSource,
} from "../../../src/domain/models/plugin-source.js";

describe("parsePluginSource", () => {
  describe("github kind", () => {
    it("round-trips a minimal github source", () => {
      const raw = { kind: "github", repo: "owner/repo" };
      const src = parsePluginSource(raw);
      expect(serializePluginSource(src)).toEqual(raw);
    });

    it("round-trips a github source with ref and sha", () => {
      const raw = { kind: "github", repo: "owner/repo", ref: "main", sha: "a".repeat(40) };
      const src = parsePluginSource(raw);
      expect(serializePluginSource(src)).toEqual(raw);
    });

    it("throws when repo is missing", () => {
      expect(() => parsePluginSource({ kind: "github" })).toThrow(InvalidPluginSourceError);
    });

    it("throws when repo format is invalid", () => {
      expect(() => parsePluginSource({ kind: "github", repo: "not-valid" })).toThrow(
        InvalidPluginSourceError
      );
    });
  });

  describe("url kind", () => {
    it("round-trips a url source", () => {
      const raw = { kind: "url", url: "https://example.com/plugin.zip" };
      const src = parsePluginSource(raw);
      expect(serializePluginSource(src)).toEqual(raw);
    });

    it("round-trips a url source with optional fields", () => {
      const raw = {
        kind: "url",
        url: "https://example.com/plugin.zip",
        ref: "v1",
        sha: "b".repeat(40),
      };
      const src = parsePluginSource(raw);
      expect(serializePluginSource(src)).toEqual(raw);
    });

    it("throws when url is missing", () => {
      expect(() => parsePluginSource({ kind: "url" })).toThrow(InvalidPluginSourceError);
    });
  });

  describe("git-subdir kind", () => {
    it("round-trips a git-subdir source", () => {
      const raw = {
        kind: "git-subdir",
        url: "https://github.com/org/repo.git",
        path: "plugins/my-plugin",
      };
      const src = parsePluginSource(raw);
      expect(serializePluginSource(src)).toEqual(raw);
    });

    it("throws when url is missing", () => {
      expect(() => parsePluginSource({ kind: "git-subdir", path: "sub" })).toThrow(
        InvalidPluginSourceError
      );
    });

    it("throws when path is missing", () => {
      expect(() => parsePluginSource({ kind: "git-subdir", url: "https://example.com" })).toThrow(
        InvalidPluginSourceError
      );
    });
  });

  describe("npm kind", () => {
    it("round-trips a minimal npm source", () => {
      const raw = { kind: "npm", package: "@my-org/my-plugin" };
      const src = parsePluginSource(raw);
      expect(serializePluginSource(src)).toEqual(raw);
    });

    it("round-trips an npm source with version and registry", () => {
      const raw = {
        kind: "npm",
        package: "@my-org/my-plugin",
        version: "1.2.3",
        registry: "https://registry.npmjs.org",
      };
      const src = parsePluginSource(raw);
      expect(serializePluginSource(src)).toEqual(raw);
    });

    it("throws when package is missing", () => {
      expect(() => parsePluginSource({ kind: "npm" })).toThrow(InvalidPluginSourceError);
    });
  });

  describe("local kind", () => {
    it("round-trips a local source", () => {
      const raw = { kind: "local", path: "./plugins/my-plugin" };
      const src = parsePluginSource(raw);
      expect(serializePluginSource(src)).toEqual(raw);
    });

    it("throws when path is missing", () => {
      expect(() => parsePluginSource({ kind: "local" })).toThrow(InvalidPluginSourceError);
    });
  });

  describe("invalid inputs", () => {
    it("throws for unknown kind", () => {
      expect(() => parsePluginSource({ kind: "svn", url: "svn://example.com" })).toThrow(
        InvalidPluginSourceError
      );
    });

    it("throws for null", () => {
      expect(() => parsePluginSource(null)).toThrow(InvalidPluginSourceError);
    });

    it("throws for array", () => {
      expect(() => parsePluginSource([])).toThrow(InvalidPluginSourceError);
    });

    it("throws for primitive string", () => {
      expect(() => parsePluginSource("github:owner/repo")).toThrow(InvalidPluginSourceError);
    });

    it("throws when kind is missing", () => {
      expect(() => parsePluginSource({ repo: "owner/repo" })).toThrow(InvalidPluginSourceError);
    });
  });
});
