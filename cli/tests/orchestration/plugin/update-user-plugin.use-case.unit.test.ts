import { describe, expect, it } from "vitest";
import type { AfterPreflight } from "../../../src/contexts/installation/application/plugin/update-plugin-command.js";
import { RecordedPlugin } from "../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { UserPluginUpdatePartialError } from "../../../src/orchestration/orchestration.error.js";
import { UpdateUserPlugin } from "../../../src/orchestration/plugin/update-user-plugin.use-case.js";
import type { PathContainment } from "../../../src/shared/domain/paths.model.js";
import {
  SYNTHETIC_TOOL,
  syntheticCatalog,
} from "../../shared/testing/synthetic-tool-id.builder.js";

describe("updating a user plugin", () => {
  it("hands the host registration's ref selection to the file update", async () => {
    const selection = {
      isQualifiedRef: () => false,
      refSelectedBy: () => true,
      claimsOf: () => [],
      holdersOf: () => [],
      pluginClaimsOf: () => [],
      loadRecords: async () => new Map(),
    };
    let seen: unknown;
    const update = new UpdateUserPlugin(
      {
        execute: async (options) => {
          seen = options.machine?.refSelection;
          return { updated: [], skippedUserScope: [] };
        },
      },
      { execute: async () => ({ apply() {} }) },
      () => true,
      selection
    );

    await update.execute({ toolIds: [], projectRoot: "/A", scope: "user" });

    expect(seen).toBe(selection);
  });

  it("hands the injected containment rule and the host refresh to the file update", async () => {
    const seen: { within?: PathContainment; refreshed: number } = { refreshed: 0 };
    const contained: PathContainment = () => false;
    const update = new UpdateUserPlugin(
      {
        execute: async (options) => {
          seen.within = options.machine?.isWithinUserScope;
          await options.machine?.refreshNative({
            tool: syntheticCatalog().aiProfile(SYNTHETIC_TOOL),
            ref: "a@b",
            projectRoot: "/A",
            registrations: undefined,
          });
          return { updated: [], skippedUserScope: [] };
        },
      },
      {
        execute: async () => {
          seen.refreshed += 1;
          return { apply() {} };
        },
      },
      contained,
      {
        isQualifiedRef: () => false,
        refSelectedBy: () => false,
        claimsOf: () => [],
        holdersOf: () => [],
        pluginClaimsOf: () => [],
        loadRecords: async () => new Map(),
      }
    );

    await update.execute({ toolIds: [], projectRoot: "/A", scope: "user" });

    expect(seen.within).toBe(contained);
    expect(seen.refreshed).toBe(1);
  });

  describe("once a tool's preflight passed", () => {
    const afterPreflight = async () => {
      let seen: AfterPreflight | undefined;
      await new UpdateUserPlugin(
        {
          execute: async (options) => {
            seen = options.machine?.afterPreflight;
            return { updated: [], skippedUserScope: [] };
          },
        },
        { execute: async () => ({ apply() {} }) },
        () => true,
        {
          isQualifiedRef: () => false,
          refSelectedBy: () => false,
          claimsOf: () => [],
          holdersOf: () => [],
          pluginClaimsOf: () => [],
          loadRecords: async () => new Map(),
        }
      ).execute({ toolIds: [], projectRoot: "/A", scope: "user" });
      if (seen === undefined) throw new Error("the file update was never run");
      return seen;
    };

    it("names a failed file application as a partial update of that tool", async () => {
      const cause = new Error("disk full");

      const failure = await (await afterPreflight())(SYNTHETIC_TOOL, () =>
        Promise.reject(cause)
      ).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(UserPluginUpdatePartialError);
      expect(failure).toMatchObject({ toolId: SYNTHETIC_TOOL, cause });
    });

    it("answers the applied plugin when the files land", async () => {
      const applied = RecordedPlugin.fromJSON({
        name: "aidd-dev",
        source: { kind: "local", path: "/fixture" },
        version: "1.0.0",
        strict: false,
        files: {},
        scope: "user",
      });

      await expect((await afterPreflight())(SYNTHETIC_TOOL, async () => applied)).resolves.toBe(
        applied
      );
    });
  });
});
