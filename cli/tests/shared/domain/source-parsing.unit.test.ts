import { describe, expect, it } from "vitest";
import { InvalidPluginSourceError } from "../../../src/shared/domain/shared.error.js";
import { serializePluginSource } from "../../../src/shared/domain/source.js";
import { parsePluginSource } from "../../../src/shared/domain/source-parsing.js";
import { saying } from "../testing/saying.builder.js";

/** The message every npm name refusal shares. */
const npmNameDetail = (got: string): string =>
  `"package" must be a valid npm package name (e.g. my-plugin or @scope/my-plugin). Got: "${got}"`;

describe("parsePluginSource", () => {
  describe("github kind", () => {
    it("round-trips a minimal github source", () => {
      const raw = { kind: "github", repo: "owner/repo" };
      const src = parsePluginSource(raw);
      expect(serializePluginSource(src)).toStrictEqual(raw);
    });

    it("round-trips a github source with ref and sha", () => {
      const raw = { kind: "github", repo: "owner/repo", ref: "main", sha: "a".repeat(40) };
      const src = parsePluginSource(raw);
      expect(serializePluginSource(src)).toStrictEqual(raw);
    });

    it("throws when repo is missing", () => {
      expect(() => parsePluginSource({ kind: "github" })).toThrow(
        new InvalidPluginSourceError('"repo" must be a non-empty string.')
      );
    });

    it("throws when repo format is invalid", () => {
      expect(() => parsePluginSource({ kind: "github", repo: "not-valid" })).toThrow(
        new InvalidPluginSourceError('"repo" must match owner/repo format.')
      );
    });
  });

  describe("url kind", () => {
    it("round-trips a url source", () => {
      const raw = { kind: "url", url: "https://example.com/plugin.zip" };
      const src = parsePluginSource(raw);
      expect(serializePluginSource(src)).toStrictEqual(raw);
    });

    it("round-trips a url source with optional fields", () => {
      const raw = {
        kind: "url",
        url: "https://example.com/plugin.zip",
        ref: "v1",
        sha: "b".repeat(40),
      };
      const src = parsePluginSource(raw);
      expect(serializePluginSource(src)).toStrictEqual(raw);
    });

    it("throws when url is missing", () => {
      expect(() => parsePluginSource({ kind: "url" })).toThrow(
        new InvalidPluginSourceError('"url" must be a non-empty string.')
      );
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
      expect(serializePluginSource(src)).toStrictEqual(raw);
    });

    it("keeps the ref and the sha through a round trip", () => {
      // `InstalledPlugin.create` serializes then re-parses this in memory, never through
      // JSON, and dropping `ref` unpins the plugin: the default branch, not the version asked for.
      const raw = {
        kind: "git-subdir",
        url: "https://github.com/org/repo.git",
        path: "plugins/my-plugin",
        ref: "v1.2.0",
        sha: "b".repeat(40),
      };
      expect(serializePluginSource(parsePluginSource(raw))).toStrictEqual(raw);
    });

    it("throws when url is missing", () => {
      expect(() => parsePluginSource({ kind: "git-subdir", path: "sub" })).toThrow(
        new InvalidPluginSourceError('"url" must be a non-empty string.')
      );
    });

    it("throws when path is missing", () => {
      expect(() => parsePluginSource({ kind: "git-subdir", url: "https://example.com" })).toThrow(
        new InvalidPluginSourceError('"path" must be a non-empty string.')
      );
    });
  });

  describe("npm kind", () => {
    it("round-trips a minimal npm source", () => {
      const raw = { kind: "npm", package: "@my-org/my-plugin" };
      const src = parsePluginSource(raw);
      expect(serializePluginSource(src)).toStrictEqual(raw);
    });

    it("round-trips an npm source with version and registry", () => {
      const raw = {
        kind: "npm",
        package: "@my-org/my-plugin",
        version: "1.2.3",
        registry: "https://registry.npmjs.org",
      };
      const src = parsePluginSource(raw);
      expect(serializePluginSource(src)).toStrictEqual(raw);
    });

    it("throws when package is missing", () => {
      expect(() => parsePluginSource({ kind: "npm" })).toThrow(
        new InvalidPluginSourceError('"package" must be a non-empty string.')
      );
    });

    describe("npm name security validation", () => {
      it("accepts a valid unscoped package name", () => {
        expect(() => parsePluginSource({ kind: "npm", package: "my-plugin" })).not.toThrow();
      });

      it("accepts a valid scoped package name", () => {
        expect(() =>
          parsePluginSource({ kind: "npm", package: "@my-org/my-plugin" })
        ).not.toThrow();
      });

      it("rejects a package name starting with a dash (injection vector)", () => {
        expect(() => parsePluginSource({ kind: "npm", package: "-x" })).toThrow(
          new InvalidPluginSourceError(npmNameDetail("-x"))
        );
      });

      it("rejects a package name starting with double-dash (option injection)", () => {
        expect(() =>
          parsePluginSource({ kind: "npm", package: "--registry=https://evil.com" })
        ).toThrow(new InvalidPluginSourceError(npmNameDetail("--registry=https://evil.com")));
      });

      it("rejects a package name starting with a dot", () => {
        expect(() => parsePluginSource({ kind: "npm", package: ".my-plugin" })).toThrow(
          new InvalidPluginSourceError(npmNameDetail(".my-plugin"))
        );
      });

      it("rejects a package name with a trailing invalid character", () => {
        expect(() => parsePluginSource({ kind: "npm", package: "my-plugin!" })).toThrow(
          new InvalidPluginSourceError(npmNameDetail("my-plugin!"))
        );
      });

      it("rejects a package name with uppercase letters", () => {
        expect(() => parsePluginSource({ kind: "npm", package: "My-Plugin" })).toThrow(
          new InvalidPluginSourceError(npmNameDetail("My-Plugin"))
        );
      });
    });
  });

  describe("local kind", () => {
    it("round-trips a local source", () => {
      const raw = { kind: "local", path: "./plugins/my-plugin" };
      const src = parsePluginSource(raw);
      expect(serializePluginSource(src)).toStrictEqual(raw);
    });

    it("throws when path is missing", () => {
      expect(() => parsePluginSource({ kind: "local" })).toThrow(
        new InvalidPluginSourceError('"path" must be a non-empty string.')
      );
    });
  });

  describe("a source recorded as a plain string", () => {
    // A manifest may record a source as a string rather than an object. Read wrong, the
    // plugin is fetched from the wrong place - or a valid record is refused on load.
    it("reads a bare owner/repo as a github source", () => {
      expect(parsePluginSource("ai-driven-dev/framework")).toEqual({
        kind: "github",
        repo: "ai-driven-dev/framework",
      });
    });

    it("reads a relative path as a local source", () => {
      expect(parsePluginSource("./plugins/mine")).toEqual({
        kind: "local",
        path: "./plugins/mine",
      });
    });

    it("reads an absolute path as a local source", () => {
      expect(parsePluginSource("/opt/plugins/mine")).toEqual({
        kind: "local",
        path: "/opt/plugins/mine",
      });
    });
  });

  describe("a field that is present but empty", () => {
    it("refuses an empty path rather than recording a source pointing nowhere", () => {
      expect(() => parsePluginSource({ kind: "local", path: "" })).toThrow(
        saying(/"path" must be a non-empty string/)
      );
    });
  });

  describe("invalid inputs", () => {
    it("throws for unknown kind", () => {
      expect(() => parsePluginSource({ kind: "svn", url: "svn://example.com" })).toThrow(
        new InvalidPluginSourceError(
          'unknown kind "svn". Expected: github, url, git-subdir, npm, local.'
        )
      );
    });

    it("throws for null", () => {
      expect(() => parsePluginSource(null)).toThrow(
        new InvalidPluginSourceError("expected an object.")
      );
    });

    it("throws for a number", () => {
      expect(() => parsePluginSource(42)).toThrow(
        new InvalidPluginSourceError("expected an object.")
      );
    });

    it("throws for array", () => {
      expect(() => parsePluginSource([])).toThrow(
        new InvalidPluginSourceError("expected an object.")
      );
    });

    it("throws for primitive string", () => {
      expect(() => parsePluginSource("github:owner/repo")).toThrow(
        new InvalidPluginSourceError(
          'string source "github:owner/repo" is not a recognized path or repo.'
        )
      );
    });

    it("throws when kind is missing", () => {
      expect(() => parsePluginSource({ repo: "owner/repo" })).toThrow(
        new InvalidPluginSourceError(
          'unknown kind "undefined". Expected: github, url, git-subdir, npm, local.'
        )
      );
    });
  });
});

/**
 * A manifest field of the wrong type must be refused, not coerced: a source silently
 * accepted here is a fetch that fails much later, with an error naming the wrong thing.
 */
describe("a manifest field of the wrong type", () => {
  it("refuses a non-string optional field", () => {
    expect(() => parsePluginSource({ kind: "github", repo: "owner/repo", ref: 3 })).toThrow(
      saying(/"ref" must be a string/)
    );
  });

  it("accepts the field being absent", () => {
    expect(parsePluginSource({ kind: "github", repo: "owner/repo" })).toEqual({
      kind: "github",
      repo: "owner/repo",
    });
  });

  it("refuses a sha that is not 40 lowercase hex characters", () => {
    expect(() => parsePluginSource({ kind: "github", repo: "owner/repo", sha: "ABC123" })).toThrow(
      saying(/40-character lowercase hex/)
    );
  });

  it.each([`${"a".repeat(40)}x`, `x${"a".repeat(40)}`])(
    "refuses a sha with a stray character around the 40 hex ones: %s",
    (sha) => {
      expect(() => parsePluginSource({ kind: "github", repo: "owner/repo", sha })).toThrow(
        saying(/40-character lowercase hex/)
      );
    }
  );

  it("accepts a well-formed sha", () => {
    const sha = "a".repeat(40);
    expect(parsePluginSource({ kind: "github", repo: "owner/repo", sha })).toEqual({
      kind: "github",
      repo: "owner/repo",
      sha,
    });
  });

  it("lists the kinds it knows when given one it does not", () => {
    expect(() => parsePluginSource({ kind: "svn" })).toThrow(
      saying(/Expected: github, url, git-subdir, npm, local/)
    );
  });
});
