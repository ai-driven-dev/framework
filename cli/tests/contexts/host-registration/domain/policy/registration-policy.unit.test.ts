import { describe, expect, it } from "vitest";
import {
  judgeRegistration,
  type RefreshReadings,
  type RegisterReadings,
  type WithdrawCatalogReadings,
} from "../../../../../src/contexts/host-registration/domain/policy/registration-policy.js";

const PROVEN: RegisterReadings = {
  intent: "register",
  canonical: true,
  hostReadable: true,
  sourceStatus: "owned",
};

describe("judgeRegistration, register", () => {
  it("proceeds with the readings that proved it", () => {
    expect(judgeRegistration(PROVEN)).toStrictEqual({ outcome: "proceed", evidence: PROVEN });
  });

  it.each([
    ["not canonical", { canonical: false }, "not-canonical"],
    ["the host registry unreadable", { hostReadable: false }, "host-unreadable"],
    ["a source absent", { sourceStatus: "absent" }, "source-not-owned"],
    ["a source unproven", { sourceStatus: "unproven" }, "source-not-owned"],
  ] satisfies [string, Partial<RegisterReadings>, string][])("refuses %s", (_, fault, reason) => {
    expect(judgeRegistration({ ...PROVEN, ...fault })).toMatchObject({ outcome: "refuse", reason });
  });

  it("names the first proof that failed", () => {
    expect(
      judgeRegistration({
        ...PROVEN,
        canonical: false,
        hostReadable: false,
        sourceStatus: "absent",
      })
    ).toMatchObject({ reason: "not-canonical" });
    expect(
      judgeRegistration({ ...PROVEN, hostReadable: false, sourceStatus: "absent" })
    ).toMatchObject({ reason: "host-unreadable" });
    expect(
      judgeRegistration({ ...PROVEN, sourceStatus: "absent", foreignRef: "other@catalog" })
    ).toMatchObject({ reason: "source-not-owned" });
  });

  it("hands back the foreign ref to reconcile, whatever refused first", () => {
    expect(judgeRegistration({ ...PROVEN, foreignRef: "other@catalog" })).toStrictEqual({
      outcome: "refuse",
      reason: "foreign-ref",
      reconcile: "other@catalog",
    });
    expect(
      judgeRegistration({ ...PROVEN, canonical: false, foreignRef: "other@catalog" })
    ).toMatchObject({ reconcile: "other@catalog" });
    expect(judgeRegistration({ ...PROVEN, canonical: false })).toMatchObject({
      reconcile: undefined,
    });
  });
});

const PROVEN_REF: Pick<RefreshReadings, "refEnabled" | "source"> = {
  refEnabled: true,
  source: { status: "owned" },
};

describe.each(["refresh", "withdraw-ref"] as const)("judgeRegistration, %s", (intent) => {
  const REFRESHABLE = { intent, ...PROVEN_REF };

  it("proceeds with the readings that proved it", () => {
    expect(judgeRegistration(REFRESHABLE)).toStrictEqual({
      outcome: "proceed",
      evidence: REFRESHABLE,
    });
  });

  it("refuses a ref the host does not provably enable", () => {
    expect(judgeRegistration({ ...REFRESHABLE, refEnabled: false })).toStrictEqual({
      outcome: "refuse",
      reason: "ref-not-enabled",
      reconcile: undefined,
    });
  });

  it("refuses a ref with no canonical catalogue to read", () => {
    expect(judgeRegistration({ ...REFRESHABLE, source: undefined })).toStrictEqual({
      outcome: "refuse",
      reason: "no-canonical-source",
      reconcile: undefined,
    });
  });

  it.each(["absent", "unproven"] as const)(
    "refuses a %s source, handing back why it was not owned",
    (status) => {
      expect(
        judgeRegistration({ ...REFRESHABLE, source: { status, reason: "registered elsewhere" } })
      ).toStrictEqual({
        outcome: "refuse",
        reason: "source-not-owned",
        reconcile: "registered elsewhere",
      });
      expect(judgeRegistration({ ...REFRESHABLE, source: { status } })).toMatchObject({
        reconcile: undefined,
      });
    }
  );

  it("names the first proof that failed", () => {
    expect(
      judgeRegistration({ ...REFRESHABLE, refEnabled: false, source: undefined })
    ).toMatchObject({ reason: "ref-not-enabled" });
  });
});

const WITHDRAWABLE: WithdrawCatalogReadings = {
  intent: "withdraw-catalog",
  source: { status: "owned" },
  unenabledClaim: undefined,
};

describe("judgeRegistration, withdraw-catalog", () => {
  it("proceeds with the readings that proved it", () => {
    expect(judgeRegistration(WITHDRAWABLE)).toStrictEqual({
      outcome: "proceed",
      evidence: WITHDRAWABLE,
    });
  });

  it.each(["absent", "unproven"] as const)(
    "refuses a %s source, handing back why it was not owned",
    (status) => {
      expect(
        judgeRegistration({ ...WITHDRAWABLE, source: { status, reason: "registered elsewhere" } })
      ).toStrictEqual({
        outcome: "refuse",
        reason: "source-not-owned",
        reconcile: "registered elsewhere",
      });
    }
  );

  it("refuses a claim the host does not provably enable, naming it", () => {
    expect(judgeRegistration({ ...WITHDRAWABLE, unenabledClaim: "p@catalog" })).toStrictEqual({
      outcome: "refuse",
      reason: "claim-not-enabled",
      reconcile: "p@catalog",
    });
  });

  it("refuses the source before a claim", () => {
    expect(
      judgeRegistration({
        ...WITHDRAWABLE,
        source: { status: "unproven" },
        unenabledClaim: "p@catalog",
      })
    ).toMatchObject({ reason: "source-not-owned" });
  });
});
