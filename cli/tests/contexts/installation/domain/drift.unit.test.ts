import { describe, expect, it } from "vitest";
import { driftOf, driftOfKeys } from "../../../../src/contexts/installation/domain/drift.js";
import { FileHash } from "../../../../src/shared/domain/file-hash.js";

const HASH_A = new FileHash("a".repeat(32));
const HASH_B = new FileHash("b".repeat(32));
const HASH_C = new FileHash("c".repeat(32));
const DIGEST_A = HASH_A.value;

describe("drift of a recorded file", () => {
  it("is missing when the file is absent from disk", () => {
    expect(driftOf(DIGEST_A, null)).toBe("missing");
  });

  it("is ok when the disk holds the recorded hash", () => {
    expect(driftOf(DIGEST_A, new FileHash("a".repeat(32)))).toBe("ok");
  });

  it("is modified when the disk holds another hash", () => {
    expect(driftOf(DIGEST_A, HASH_B)).toBe("modified");
  });

  it("is modified, not refused, when the recorded digest is no MD5 a manifest ever validated", () => {
    expect(driftOf("hand-edited", HASH_A)).toBe("modified");
  });
});

describe("drift of recorded merge keys", () => {
  const recorded = { alpha: HASH_A, beta: HASH_B };

  it("is missing when the file is absent from disk", () => {
    expect(driftOfKeys(recorded, null)).toBe("missing");
  });

  it("is ok when every recorded key holds its hash", () => {
    expect(driftOfKeys(recorded, { alpha: HASH_A, beta: HASH_B })).toBe("ok");
  });

  it("is ok when the user added a key of their own", () => {
    expect(driftOfKeys(recorded, { alpha: HASH_A, beta: HASH_B, mine: HASH_C })).toBe("ok");
  });

  it("is modified when a recorded key changed", () => {
    expect(driftOfKeys(recorded, { alpha: HASH_A, beta: HASH_C })).toBe("modified");
  });

  it("is modified when a recorded key is gone", () => {
    expect(driftOfKeys(recorded, { alpha: HASH_A })).toBe("modified");
  });

  it("is ok when no key was recorded", () => {
    expect(driftOfKeys({}, {})).toBe("ok");
  });
});
