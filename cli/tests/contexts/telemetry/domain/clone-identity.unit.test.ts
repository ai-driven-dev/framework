import { describe, expect, it } from "vitest";
import {
  type CloneIdentity,
  cloneKey,
  identityFromStat,
  parseCloneIdentity,
  type StatFacts,
  sameClone,
} from "../../../../src/contexts/telemetry/domain/consent/clone-identity.js";

const STAT: StatFacts = {
  dev: 16n,
  ino: 12345n,
  birthtimeMs: 1_700_000_000_000n,
  birthtimeNs: 1_700_000_000_000_000_000n,
  ctimeNs: 1_700_000_500_000_000_000n,
};
const CLONE: CloneIdentity = {
  path: "/a/.git",
  dev: "16",
  ino: "12345",
  birthtimeMs: 1_700_000_000_000,
};

describe("the identity of a clone from what stat reports", () => {
  it("is the device, the inode and the birth time, with the path", () => {
    expect(identityFromStat("/a/.git", STAT)).toEqual(CLONE);
  });

  it("keeps a file index that a number could not hold", () => {
    const found = identityFromStat("/a/.git", { ...STAT, ino: 9_007_199_254_740_993n });
    expect(found?.ino).toBe("9007199254740993");
  });

  it("is none where the platform reports no inode: nothing can be told to belong to it", () => {
    expect(identityFromStat("/a/.git", { ...STAT, ino: 0n })).toBeNull();
  });

  it.each([
    ["no birth time at all", 0n],
    ["a birth time before the epoch", -5n],
  ])("has a birth time of 0 for %s, the inode and device being the identity", (_name, birth) => {
    expect(identityFromStat("/a/.git", { ...STAT, birthtimeMs: birth })).toEqual({
      ...CLONE,
      birthtimeMs: 0,
    });
  });

  it("has a birth time of 0 when it is the change time to the nanosecond, which moves with every entry added", () => {
    expect(
      identityFromStat("/a/.git", {
        ...STAT,
        birthtimeMs: 1_700_000_500_000n,
        birthtimeNs: 1_700_000_500_000_000_000n,
      })
    ).toEqual({ ...CLONE, birthtimeMs: 0 });
  });

  it("keeps a birth in the change time's millisecond, a nanosecond apart from it", () => {
    expect(
      identityFromStat("/a/.git", {
        ...STAT,
        birthtimeMs: 1_700_000_500_000n,
        birthtimeNs: 1_700_000_500_000_000_000n,
        ctimeNs: 1_700_000_500_000_000_001n,
      })
    ).toEqual({ ...CLONE, birthtimeMs: 1_700_000_500_000 });
  });
});

describe("whether two looks found the same clone", () => {
  it("is when every part is the same", () => {
    expect(sameClone(CLONE, { ...CLONE })).toBe(true);
    expect(cloneKey(CLONE)).toBe(cloneKey({ ...CLONE }));
  });

  it.each([
    ["path", { path: "/b/.git" }],
    ["device", { dev: "17" }],
    ["inode", { ino: "12346" }],
    ["birth time", { birthtimeMs: 1_700_000_000_001 }],
  ])("is not when the %s differs", (_name, change) => {
    expect(sameClone(CLONE, { ...CLONE, ...change })).toBe(false);
    expect(cloneKey(CLONE)).not.toBe(cloneKey({ ...CLONE, ...change }));
  });

  it("tells a clone with no birth time from one with, at the same inode", () => {
    expect(sameClone(CLONE, { ...CLONE, birthtimeMs: 0 })).toBe(false);
  });
});

describe("a clone read back from a file", () => {
  it("round-trips", () => {
    expect(parseCloneIdentity(JSON.parse(JSON.stringify(CLONE)))).toEqual(CLONE);
  });

  it.each([
    ["not an object", "x"],
    ["no path", { ...CLONE, path: undefined }],
    ["an empty path", { ...CLONE, path: "" }],
    ["a numeric path", { ...CLONE, path: 4 }],
    ["no device", { ...CLONE, dev: undefined }],
    ["an empty device", { ...CLONE, dev: "" }],
    ["a numeric inode", { ...CLONE, ino: 4 }],
    ["an empty inode", { ...CLONE, ino: "" }],
    ["an inode of 0", { ...CLONE, ino: "0" }],
    ["a birth time that is text", { ...CLONE, birthtimeMs: "1" }],
    ["a negative birth time", { ...CLONE, birthtimeMs: -1 }],
    ["a birth time that is not finite", { ...CLONE, birthtimeMs: Number.POSITIVE_INFINITY }],
  ])("is none for %s", (_name, value) => {
    expect(parseCloneIdentity(value)).toBeNull();
  });

  it("accepts a birth time of 0", () => {
    expect(parseCloneIdentity({ ...CLONE, birthtimeMs: 0 })).toEqual({ ...CLONE, birthtimeMs: 0 });
  });
});
