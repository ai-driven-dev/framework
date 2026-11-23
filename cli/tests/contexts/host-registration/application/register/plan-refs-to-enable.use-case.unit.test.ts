import { describe, expect, it } from "vitest";
import {
  PlanRefsToEnable,
  type PlanRefsToEnableRequest,
} from "../../../../../src/contexts/host-registration/application/register/plan-refs-to-enable.use-case.js";

const plan = new PlanRefsToEnable({
  frameworkName: "framework",
  claimedRefs: () => ["claimed@host-market"],
});

const HOSTS = new Map([
  ["market", "host-market"],
  ["framework", "host-framework"],
]);

const request = (over: Partial<PlanRefsToEnableRequest> = {}): PlanRefsToEnableRequest => ({
  scope: "project",
  recordedPlugins: [],
  marketplaceAliases: ["market", "framework"],
  hostNameByAlias: HOSTS,
  nativeRecord: undefined,
  enablePlugins: [],
  ...over,
});

describe("planning the refs a host enables", () => {
  it("names each recorded plugin by the host name of its marketplace, skipping an unregistered one", () => {
    const refs = plan.execute(
      request({
        recordedPlugins: [
          { pluginName: "kept", marketplace: "market" },
          { pluginName: "orphan", marketplace: "unregistered" },
          { pluginName: "bare", marketplace: null },
        ],
      })
    );

    expect(refs).toEqual(["kept@host-market"]);
  });

  it("adds the framework plugins asked for, once, under the framework host name", () => {
    const refs = plan.execute(
      request({
        recordedPlugins: [{ pluginName: "kept", marketplace: "market" }],
        enablePlugins: ["extra", "extra"],
      })
    );

    expect(refs).toEqual(["kept@host-market", "extra@host-framework"]);
  });

  it("asks for no framework plugin when the framework marketplace has no host name", () => {
    const refs = plan.execute(
      request({ hostNameByAlias: new Map([["market", "host-market"]]), enablePlugins: ["extra"] })
    );

    expect(refs).toEqual([]);
  });

  it("recovers the refs a recorded registration holds, at user scope only", () => {
    const nativeRecord = {
      binary: "claude",
      marketplaces: [],
      pluginRefs: ["recorded@host-market"],
    };

    const user = plan.execute(request({ scope: "user", nativeRecord }));
    const project = plan.execute(request({ scope: "project", nativeRecord }));

    expect(user).toEqual(["recorded@host-market", "claimed@host-market"]);
    expect(project).toEqual([]);
  });
});
