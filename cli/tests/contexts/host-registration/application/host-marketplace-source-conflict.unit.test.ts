import { describe, expect, it } from "vitest";
import {
  hostMarketplaceSourceConflict,
  isDriftFound,
} from "../../../../src/contexts/host-registration/application/host-marketplace-source-conflict.js";
import { userBuiltMarketplaceDir } from "../../../../src/shared/domain/layout/aidd-layout.js";
import {
  errnoError,
  FaultingFileAdapter,
} from "../../../shared/testing/faulting-file-adapter.fake.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { FakeHostMarketplaceRegistry } from "../testing/fake-host-marketplace-registry.fake.js";

const NAME = "aidd-framework";
const LOCATION = "/home/.claude/plugins/known_marketplaces.json";

/**
 * `userConfigDir()` can sit behind a symlink the OS resolves on its own (macOS's `/var` →
 * `/private/var`), so an unresolved `userCacheRoot` never matches the realpath'd sources.
 */
describe("hostMarketplaceSourceConflict - resolving every path through the same realpath", () => {
  it("still decides a version-behind drift when userCacheRoot is reached through a symlink", async () => {
    const fs = new InMemoryFileAdapter({}, ["/private/var-home/.config/aidd"]);
    fs.setSymlink("/var-home", "/private/var-home");
    const rawUserCacheRoot = "/var-home/.config/aidd";
    const resolvedUserCacheRoot = "/private/var-home/.config/aidd";
    const requestedSource = userBuiltMarketplaceDir({
      userConfigDir: resolvedUserCacheRoot,
      cliVersion: "1.0.0",
      marketplaceName: NAME,
      target: "claude",
    });
    const registeredSource = userBuiltMarketplaceDir({
      userConfigDir: resolvedUserCacheRoot,
      cliVersion: "2.0.0",
      marketplaceName: NAME,
      target: "claude",
    });
    const reader = new FakeHostMarketplaceRegistry({
      location: LOCATION,
      entries: new Map([[NAME, registeredSource]]),
    });

    const check = await hostMarketplaceSourceConflict(
      { fs, tool: registeredTools().profile(TOOL.claude), reader },
      {
        requestedSource,
        requestedIdentity: { name: NAME, pluginNames: [] },
        driftContext: {
          userCacheRoot: rawUserCacheRoot,
          projectRoot: "/project",
          marketplaceName: NAME,
          target: "claude",
          platform: process.platform,
        },
      }
    );

    expect(isDriftFound(check)).toBe(true);
    expect(check && isDriftFound(check) ? check.drift : undefined).toEqual({
      kind: "version-behind",
      registeredVersion: "2.0.0",
      requestedVersion: "1.0.0",
    });
  });

  it("still decides the drift when the registered source no longer resolves on disk", async () => {
    const userCacheRoot = "/home/.config/aidd";
    const requestedSource = userBuiltMarketplaceDir({
      userConfigDir: userCacheRoot,
      cliVersion: "1.0.0",
      marketplaceName: NAME,
      target: "claude",
    });
    const registeredSource = userBuiltMarketplaceDir({
      userConfigDir: userCacheRoot,
      cliVersion: "2.0.0",
      marketplaceName: NAME,
      target: "claude",
    });
    const fs = new FaultingFileAdapter();
    fs.failOn("realpath", registeredSource, errnoError("ENOENT"));
    const reader = new FakeHostMarketplaceRegistry({
      location: LOCATION,
      entries: new Map([[NAME, registeredSource]]),
    });

    const check = await hostMarketplaceSourceConflict(
      { fs, tool: registeredTools().profile(TOOL.claude), reader },
      {
        requestedSource,
        requestedIdentity: { name: NAME, pluginNames: [] },
        driftContext: {
          userCacheRoot,
          projectRoot: "/project",
          marketplaceName: NAME,
          target: "claude",
          platform: process.platform,
        },
      }
    );

    expect(check).toStrictEqual({
      name: NAME,
      registeredSource,
      requestedSource,
      location: LOCATION,
      drift: { kind: "version-behind", registeredVersion: "2.0.0", requestedVersion: "1.0.0" },
    });
  });
});

describe("hostMarketplaceSourceConflict - without a drift context", () => {
  it("reports the different catalog the host's registry points at", async () => {
    const fs = new InMemoryFileAdapter({
      "/registered/.claude-plugin/marketplace.json": JSON.stringify({
        name: NAME,
        plugins: [{ name: "aidd-dev" }],
      }),
    });
    const reader = new FakeHostMarketplaceRegistry({
      location: LOCATION,
      entries: new Map([[NAME, "/registered"]]),
    });

    const check = await hostMarketplaceSourceConflict(
      { fs, tool: registeredTools().profile(TOOL.claude), reader },
      {
        requestedSource: "/requested",
        requestedIdentity: {
          name: NAME,
          pluginNames: ["aidd-dev", "aidd-vcs"],
        },
      }
    );

    expect(check).toStrictEqual({
      name: NAME,
      registeredSource: "/registered",
      requestedSource: "/requested",
      registeredIdentity: { name: NAME, pluginNames: ["aidd-dev"] },
      requestedIdentity: { name: NAME, pluginNames: ["aidd-dev", "aidd-vcs"] },
      location: LOCATION,
    });
  });
});

describe("isDriftFound", () => {
  it("is false for no check at all", () => {
    expect(isDriftFound(undefined)).toBe(false);
  });
});
