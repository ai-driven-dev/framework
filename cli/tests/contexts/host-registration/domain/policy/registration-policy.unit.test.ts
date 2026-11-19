import { describe, expect, it } from "vitest";
import {
  judgeRegistration,
  type RegisterReadings,
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
