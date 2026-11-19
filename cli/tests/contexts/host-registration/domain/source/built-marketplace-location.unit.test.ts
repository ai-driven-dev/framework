import { win32 } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseBuiltMarketplaceDir,
  parseBuiltMarketplaceDirAtAnyRoot,
  parseUserBuiltMarketplaceDir,
} from "../../../../../src/contexts/host-registration/domain/source/built-marketplace-location.js";
import { userBuiltMarketplaceDir } from "../../../../../src/shared/domain/layout/aidd-layout.js";

describe("parseUserBuiltMarketplaceDir()", () => {
  it("tolerates a trailing separator on the path", () => {
    expect(
      parseUserBuiltMarketplaceDir("/cfg", "/cfg/cache/built/1.0.0/mkt/claude/", "linux")
    ).toStrictEqual({
      version: "1.0.0",
      marketplaceName: "mkt",
      target: "claude",
    });
  });

  it("reads back the version, marketplace name and target userBuiltMarketplaceDir encoded", () => {
    const path = userBuiltMarketplaceDir("/user-cache", "5.0.0", "aidd-framework", "claude");

    expect(parseUserBuiltMarketplaceDir("/user-cache", path, process.platform)).toEqual({
      version: "5.0.0",
      marketplaceName: "aidd-framework",
      target: "claude",
    });
  });

  it("is undefined for a path outside the user cache root", () => {
    expect(
      parseUserBuiltMarketplaceDir(
        "/user-cache",
        "/elsewhere/5.0.0/aidd-framework/claude",
        process.platform
      )
    ).toBeUndefined();
  });

  it("is undefined for a path missing a segment", () => {
    expect(
      parseUserBuiltMarketplaceDir("/user-cache", "/user-cache/cache/built/5.0.0", process.platform)
    ).toBeUndefined();
  });

  it("reads either separator, matching pathContainsOrEquals", () => {
    expect(
      parseUserBuiltMarketplaceDir(
        "C:\\user-cache",
        "C:\\user-cache\\cache\\built\\5.0.0\\aidd-framework\\claude",
        process.platform
      )
    ).toEqual({ version: "5.0.0", marketplaceName: "aidd-framework", target: "claude" });
  });

  // A real filesystem tolerates a trailing separator on a directory, so `userConfigDir()`
  // returning one is not a corrupted path.
  it("tolerates a trailing separator on the user config dir", () => {
    const path = userBuiltMarketplaceDir("/user-cache", "5.0.0", "aidd-framework", "claude");

    expect(parseUserBuiltMarketplaceDir("/user-cache/", path, process.platform)).toEqual({
      version: "5.0.0",
      marketplaceName: "aidd-framework",
      target: "claude",
    });
  });

  // On a case-insensitive platform `C:\Users\A` and `c:\users\a` are the same directory; the
  // platform is passed explicitly rather than read from `process.platform`.
  it("matches a case-differing user config dir on a case-insensitive platform", () => {
    expect(
      parseUserBuiltMarketplaceDir(
        "C:\\Users\\A",
        "c:\\users\\a\\cache\\built\\5.0.0\\aidd-framework\\claude",
        "win32"
      )
    ).toEqual({ version: "5.0.0", marketplaceName: "aidd-framework", target: "claude" });
  });

  it("does not fold case on a case-sensitive platform", () => {
    expect(
      parseUserBuiltMarketplaceDir(
        "/User-Cache",
        "/user-cache/cache/built/5.0.0/aidd-framework/claude",
        "linux"
      )
    ).toBeUndefined();
  });
});

describe("parseBuiltMarketplaceDir()", () => {
  it("is undefined for a path carrying one segment too many", () => {
    expect(parseBuiltMarketplaceDir("/p", "/p/.aidd/cache/built/mkt/claude/extra", "linux")).toBe(
      undefined
    );
  });

  it("reads back the marketplace name and target from a project-scope built path", () => {
    expect(
      parseBuiltMarketplaceDir(
        "/proj",
        "/proj/.aidd/cache/built/aidd-framework/claude",
        process.platform
      )
    ).toEqual({
      marketplaceName: "aidd-framework",
      target: "claude",
    });
  });

  it("is undefined for a path outside the project root", () => {
    expect(
      parseBuiltMarketplaceDir(
        "/proj",
        "/other/.aidd/cache/built/aidd-framework/claude",
        process.platform
      )
    ).toBeUndefined();
  });
});

describe("parseBuiltMarketplaceDirAtAnyRoot()", () => {
  it("reads back a relative project root of a single segment", () => {
    expect(
      parseBuiltMarketplaceDirAtAnyRoot("p/.aidd/cache/built/mkt/claude", "linux")
    ).toStrictEqual({
      projectRoot: "p",
      marketplaceName: "mkt",
      target: "claude",
    });
  });

  it("is undefined when only part of the marker matches", () => {
    expect(
      parseBuiltMarketplaceDirAtAnyRoot("/p/.aidd/cache/other/mkt/claude", "linux")
    ).toBeUndefined();
  });

  it("matches the marker segment by segment, never as one string", () => {
    expect(
      parseBuiltMarketplaceDirAtAnyRoot("/p/.aidd/cache/built/mkt/claude", "linux")
    ).toStrictEqual({
      projectRoot: "/p",
      marketplaceName: "mkt",
      target: "claude",
    });
  });

  it("reads back the project root alongside the name and target, with no root known in advance", () => {
    expect(
      parseBuiltMarketplaceDirAtAnyRoot(
        "/other-project/.aidd/cache/built/aidd-framework/claude",
        "linux"
      )
    ).toStrictEqual({
      projectRoot: "/other-project",
      marketplaceName: "aidd-framework",
      target: "claude",
    });
  });

  it("reads back a nested project root", () => {
    expect(
      parseBuiltMarketplaceDirAtAnyRoot(
        "/work/repos/other-project/.aidd/cache/built/aidd-framework/codex",
        "linux"
      )
    ).toStrictEqual({
      projectRoot: "/work/repos/other-project",
      marketplaceName: "aidd-framework",
      target: "codex",
    });
  });

  it("is undefined for a path that never carries the built-cache shape at all", () => {
    expect(
      parseBuiltMarketplaceDirAtAnyRoot("/completely/unrelated/src", process.platform)
    ).toBeUndefined();
  });

  it("is undefined for a path with nothing before the marker — no project root to report", () => {
    expect(
      parseBuiltMarketplaceDirAtAnyRoot(
        "/.aidd/cache/built/aidd-framework/claude",
        process.platform
      )
    ).toBeUndefined();
  });

  it("compares the marker's own segments case-insensitively on win32", () => {
    expect(
      parseBuiltMarketplaceDirAtAnyRoot(
        "C:\\other-project\\.AIDD\\CACHE\\BUILT\\aidd-framework\\claude",
        "win32"
      )
    ).toStrictEqual({
      projectRoot: "C:\\other-project",
      marketplaceName: "aidd-framework",
      target: "claude",
    });
  });

  // Every other writer of `references.json` records a `realpath` result, backslash-separated
  // on win32, and `samePathSegment` folds case but never separators.
  it("keeps the platform's own separator in the returned project root on win32", () => {
    expect(
      parseBuiltMarketplaceDirAtAnyRoot(
        "C:\\proj\\.aidd\\cache\\built\\aidd-framework\\claude",
        "win32"
      )
    ).toStrictEqual({
      projectRoot: "C:\\proj",
      marketplaceName: "aidd-framework",
      target: "claude",
    });
  });

  it("reads back a nested win32 project root with backslashes throughout", () => {
    expect(
      parseBuiltMarketplaceDirAtAnyRoot(
        "C:\\work\\repos\\other-project\\.aidd\\cache\\built\\aidd-framework\\codex",
        "win32"
      )
    ).toStrictEqual({
      projectRoot: "C:\\work\\repos\\other-project",
      marketplaceName: "aidd-framework",
      target: "codex",
    });
  });

  describe("on a host whose path join is backslash-separated", () => {
    afterEach(() => {
      vi.doUnmock("node:path");
      vi.resetModules();
    });

    it("still finds the marker, though the layout names it with backslashes", async () => {
      vi.resetModules();
      vi.doMock("node:path", async (importOriginal) => ({
        ...(await importOriginal<typeof import("node:path")>()),
        join: win32.join,
      }));
      const { parseBuiltMarketplaceDirAtAnyRoot: parseOnWin32Host } = await import(
        "../../../../../src/contexts/host-registration/domain/source/built-marketplace-location.js"
      );

      expect(
        parseOnWin32Host("C:\\proj\\.aidd\\cache\\built\\aidd-framework\\claude", "win32")
      ).toStrictEqual({
        projectRoot: "C:\\proj",
        marketplaceName: "aidd-framework",
        target: "claude",
      });
    });
  });
});
