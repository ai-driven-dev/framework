import { describe, expect, it } from "vitest";
import {
  ConflictSet,
  ConflictType,
  classifyConflict,
} from "../../../src/domain/models/conflict-set.js";
import { FileHash } from "../../../src/domain/models/file-hash.js";

const makeHash = (hex: string): FileHash => new FileHash(hex.padEnd(32, "0"));

const hashA = makeHash("aaaa");
const hashB = makeHash("bbbb");
const hashC = makeHash("cccc");

describe("classifyConflict()", () => {
  it("returns None when disk matches manifest and new is different", () => {
    const result = classifyConflict(hashA, hashA, hashB);
    expect(result).toBe(ConflictType.None);
  });

  it("returns LocalModified when disk differs from manifest and new matches manifest", () => {
    const result = classifyConflict(hashA, hashB, hashA);
    expect(result).toBe(ConflictType.LocalModified);
  });

  it("returns BothModified when disk differs and new differs from manifest", () => {
    const result = classifyConflict(hashA, hashB, hashC);
    expect(result).toBe(ConflictType.BothModified);
  });

  it("returns DeletedLocally when diskHash is undefined", () => {
    const result = classifyConflict(hashA, undefined, hashB);
    expect(result).toBe(ConflictType.DeletedLocally);
  });
});

describe("ConflictSet", () => {
  it("getConflicts() returns the conflict entries", () => {
    const conflicts = [
      { relativePath: "a.md", type: ConflictType.LocalModified },
      { relativePath: "b.md", type: ConflictType.None },
    ];
    const set = new ConflictSet(conflicts);
    expect(set.getConflicts()).toHaveLength(2);
  });

  it("hasConflicts() returns true when there are non-None conflicts", () => {
    const set = new ConflictSet([{ relativePath: "a.md", type: ConflictType.LocalModified }]);
    expect(set.hasConflicts()).toBe(true);
  });

  it("hasConflicts() returns false when all are None", () => {
    const set = new ConflictSet([{ relativePath: "a.md", type: ConflictType.None }]);
    expect(set.hasConflicts()).toBe(false);
  });


});
