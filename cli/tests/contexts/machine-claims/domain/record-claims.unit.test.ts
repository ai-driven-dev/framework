import { describe, expect, it } from "vitest";
import {
  joinPluginClaims,
  splitPluginClaims,
} from "../../../../src/contexts/machine-claims/domain/record-claims.js";
import type { MachineRecords } from "../../../../src/contexts/machine-claims/ports/machine-manifest.js";
import {
  SECOND_SYNTHETIC_TOOL,
  SYNTHETIC_TOOL,
} from "../../../shared/testing/synthetic-tool-id.builder.js";

const claims = [{ ref: "plugin@declared", dependents: ["/project-a"] }];
const hostData = { binary: "synthetic", pluginRefs: ["plugin@declared"] };

describe("a record's claims, kept apart from its host data", () => {
  it("splits the claims block off the host data", () => {
    const split = splitPluginClaims(
      new Map([[SYNTHETIC_TOOL, { ...hostData, pluginClaims: claims }]])
    );

    expect(split.host).toStrictEqual(new Map([[SYNTHETIC_TOOL, hostData]]));
    expect(split.claims).toStrictEqual(new Map([[SYNTHETIC_TOOL, claims]]));
  });

  it("records no claims for a tool without a claims block", () => {
    const split = splitPluginClaims(new Map([[SYNTHETIC_TOOL, hostData]]));

    expect(split.claims.size).toBe(0);
  });

  it("joins back to the records it was split from", () => {
    const records: MachineRecords = new Map();
    records.set(SYNTHETIC_TOOL, { ...hostData, pluginClaims: claims });
    records.set(SECOND_SYNTHETIC_TOOL, hostData);

    const { host, claims: held } = splitPluginClaims(records);

    expect(joinPluginClaims(host, held)).toStrictEqual(records);
  });

  it("records a tool holding only claims with its claims alone", () => {
    expect(joinPluginClaims(new Map(), new Map([[SYNTHETIC_TOOL, claims]]))).toStrictEqual(
      new Map([[SYNTHETIC_TOOL, { pluginClaims: claims }]])
    );
  });
});
