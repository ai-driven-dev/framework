import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  callHost,
  describeSharedSourceSurvival,
  survivingCachePaths,
  uninstallAtFirstAcceptedScope,
} from "../../../../../src/contexts/host-registration/application/withdraw/host-call.js";
import type { WithdrawalDeps } from "../../../../../src/contexts/host-registration/application/withdraw/withdrawal.js";
import { recordedRegistrations } from "../../../../../src/contexts/host-registration/domain/record/registration-record.js";
import { NativePluginCliError } from "../../../../../src/shared/domain/errors.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.js";
import { FakeHostActions } from "../../../../shared/testing/fake-host-actions.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.js";

const CACHE_ROOT = "/cache";
const HOST_NAME = "aidd-framework";
const CANDIDATE = join(CACHE_ROOT, HOST_NAME);

function depsOf(logger: CapturingLogger): WithdrawalDeps {
  return {
    fs: new InMemoryFileAdapter({}),
    logger,
    ports: {
      activators: new Map(),
      pluginRegistries: new Map(),
      marketplaceRegistries: new Map(),
      sources: new Map(),
    },
  };
}

describe("calling the host without throwing", () => {
  it("confirms a call the host accepted", () => {
    const logger = new CapturingLogger();

    expect(callHost(depsOf(logger), () => undefined, "claude plugin list")).toBe(true);
    expect(logger.warnMessages).toStrictEqual([]);
  });

  it("names a refused call in a warning and does not confirm it", () => {
    const logger = new CapturingLogger();

    const confirmed = callHost(
      depsOf(logger),
      () => {
        throw new NativePluginCliError("denied");
      },
      "claude plugin list"
    );

    expect(confirmed).toBe(false);
    expect(logger.warnMessages).toStrictEqual(["claude plugin list failed: denied"]);
  });
});

describe("uninstalling at the first scope the host accepts", () => {
  const REF = "plugin@aidd-framework";

  it("stops at the first accepted scope", () => {
    const activator = new FakeHostActions({
      available: true,
      installedAtScope: new Map([[REF, "user"]]),
    });

    expect(uninstallAtFirstAcceptedScope(activator, REF, ["project", "user"])).toBeUndefined();
    expect(activator.uninstalledPluginScopes.at(-1)).toBe("user");
  });

  it("returns the host's last refusal when no scope is accepted", () => {
    const activator = new FakeHostActions({ available: true, failOnUninstall: [REF] });

    expect(uninstallAtFirstAcceptedScope(activator, REF, ["project", "user"])).toMatch(/\S/);
  });
});

describe("what survives a shared registration left in place", () => {
  const survives = `Its entry survives at userConfigDir()/marketplaces.json, and its cache at: ${CANDIDATE}.`;

  it("counts one other project in the singular", () => {
    expect(
      describeSharedSourceSurvival(HOST_NAME, CACHE_ROOT, {
        alias: HOST_NAME,
        otherProjects: ["/a"],
      })
    ).toBe(`${survives} Still referenced by 1 other project on this machine.`);
  });

  // A verb-agreement bug hides in the plural alone: only the plural case can pin it.
  it("counts several other projects in the plural", () => {
    expect(
      describeSharedSourceSurvival(HOST_NAME, CACHE_ROOT, {
        alias: HOST_NAME,
        otherProjects: ["/a", "/b"],
      })
    ).toBe(`${survives} Still referenced by 2 other projects on this machine.`);
  });

  it("says nothing removes the source yet once no project references it", () => {
    expect(
      describeSharedSourceSurvival(HOST_NAME, CACHE_ROOT, { alias: HOST_NAME, otherProjects: [] })
    ).toBe(
      `${survives} No project on this machine still references it — \`aidd clean --scope user\` is what purges it for the machine.`
    );
  });
});

describe("what survives a binary this run could not reach", () => {
  it("names one cache path per marketplace, comma separated", () => {
    const registrations = recordedRegistrations({
      binary: "codex",
      marketplaces: [
        { alias: "mkt-a", hostName: "mkt-a" },
        { alias: "mkt-b", hostName: "mkt-b" },
      ],
      pluginRefs: [],
    });

    expect(survivingCachePaths(CACHE_ROOT, registrations)).toBe(
      ` Its cache survives at: ${join(CACHE_ROOT, "mkt-a")}, ${join(CACHE_ROOT, "mkt-b")}.`
    );
  });
});
