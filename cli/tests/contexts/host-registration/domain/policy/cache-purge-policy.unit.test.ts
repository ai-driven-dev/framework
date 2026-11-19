import { describe, expect, it } from "vitest";
import {
  judgeConfirmation,
  judgeEmptiness,
  judgeRegistryClearance,
} from "../../../../../src/contexts/host-registration/domain/policy/cache-purge-policy.js";

const LABEL = "claude: cache for 'aidd'";
const CANDIDATE = "/cache/aidd";
const LOCATION = "/host/known_marketplaces.json";

describe("judgeConfirmation", () => {
  it("purges what a confirmed removal left behind", () => {
    expect(judgeConfirmation(LABEL, CANDIDATE, true)).toEqual({ purge: true });
  });

  it("keeps it, naming the removal nobody confirmed", () => {
    expect(judgeConfirmation(LABEL, CANDIDATE, false)).toEqual({
      purge: false,
      warning: `${LABEL} left in place, its own removal was not confirmed: ${CANDIDATE}`,
    });
  });
});

describe("judgeEmptiness", () => {
  it("purges a directory that holds nothing", () => {
    expect(judgeEmptiness(LABEL, CANDIDATE, 0)).toEqual({ purge: true });
  });

  it("keeps a directory that holds a single file, counting it", () => {
    expect(judgeEmptiness(LABEL, CANDIDATE, 1)).toEqual({
      purge: false,
      warning: `${LABEL} left in place, it still holds 1 file(s): ${CANDIDATE}`,
    });
  });
});

describe("judgeRegistryClearance", () => {
  const judge = (reading: Parameters<typeof judgeRegistryClearance>[3]) =>
    judgeRegistryClearance("claude", "aidd", CANDIDATE, reading);

  it("purges when the registry never existed", () => {
    expect(judge({ location: LOCATION, absent: true })).toEqual({ purge: true });
  });

  it("purges when the registry exists and no longer names the host name", () => {
    const entries = new Map([["another", "/another"]]);
    expect(judge({ location: LOCATION, entries })).toEqual({ purge: true });
  });

  it("keeps the cache, naming the registry that still names the host name", () => {
    const entries = new Map([["aidd", "/elsewhere"]]);
    expect(judge({ location: LOCATION, entries })).toEqual({
      purge: false,
      warning: `claude: cache for 'aidd' left in place, ${LOCATION} still names it: ${CANDIDATE}`,
    });
  });

  it("keeps the cache when the registry could not be read, never reading it as empty", () => {
    expect(judge({ location: LOCATION, unreadable: "EACCES" })).toEqual({
      purge: false,
      warning: `claude: plugin cache left in place, its registry could not be read: ${LOCATION}`,
    });
  });
});
