import { describe, expect, it } from "vitest";
import {
  marketplaceCacheDir,
  parseBuiltMarketplaceDir,
  parseBuiltMarketplaceDirAtAnyRoot,
  parseUserBuiltMarketplaceDir,
  samePath,
  samePathSegment,
} from "../../src/kernel/paths.js";

describe("marketplaceCacheDir()", () => {
  it("nests the marketplace under the project's cache", () => {
    expect(marketplaceCacheDir("/p", "mkt").replace(/\\/g, "/")).toBe(
      "/p/.aidd/cache/marketplaces/mkt"
    );
  });
});

describe("parseBuiltMarketplaceDir()", () => {
  it("is undefined for a path carrying one segment too many", () => {
    expect(parseBuiltMarketplaceDir("/p", "/p/.aidd/cache/built/mkt/claude/extra", "linux")).toBe(
      undefined
    );
  });
});

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
    expect(parseBuiltMarketplaceDirAtAnyRoot("/p/.aidd/cache/other/mkt/claude", "linux")).toBe(
      undefined
    );
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
});

describe("samePathSegment()", () => {
  it("tells two different names apart on win32 too", () => {
    expect(samePathSegment("alpha", "beta", "win32")).toBe(false);
  });
});

describe("samePath()", () => {
  it("calls a realpath answer and a stored path the same directory when only separators differ", () => {
    expect(samePath("/user-cache/built/1.0.0", "\\user-cache\\built\\1.0.0", "win32")).toBe(true);
  });

  it("still tells two different directories apart", () => {
    expect(samePath("/user-cache/built/1.0.0", "\\user-cache\\built\\2.0.0", "win32")).toBe(false);
  });

  it("folds case where the filesystem does, and nowhere else", () => {
    expect(samePath("/Cache/Built", "/cache/built", "win32")).toBe(true);
    expect(samePath("/Cache/Built", "/cache/built", "linux")).toBe(false);
  });

  it("leaves a posix path that legitimately holds a backslash alone on posix", () => {
    expect(samePath("/odd/a", "/odd\\a", "linux")).toBe(false);
  });
});
