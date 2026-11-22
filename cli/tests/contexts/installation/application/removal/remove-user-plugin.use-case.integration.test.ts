import { describe, expect, it } from "vitest";
import { claimsRecorded } from "../../../../shared/testing/host-record-reading.builder.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { saying } from "../../../../shared/testing/saying.builder.js";
import {
  NATIVE_REF,
  type NativeRemovalOptions,
  nativeSourceFor,
  nativeUserPluginRemoval,
  OTHER_NATIVE_REF,
} from "../../testing/native-user-plugin-removal.builder.js";
import type { userPluginRemover } from "../../testing/plugin-remover.builder.js";
import { REWRITTEN_BINARY, spiedRecordRules } from "../../testing/spy-record-rules.fake.js";

for (const toolId of [TOOL.codex, TOOL.copilot]) {
  describe(`${toolId} targeted user plugin removal`, () => {
    const fixture = (options: NativeRemovalOptions = {}) =>
      nativeUserPluginRemoval(toolId, options);

    const execute = (remove: ReturnType<typeof userPluginRemover>, pluginName: string) =>
      remove.execute({
        pluginName,
        toolIds: [toolId],
        projectRoot: "/A",
      });

    it.each([{ hostRegistryUnavailable: true }, { hostRegistryUnreadable: true }])(
      "retains all ownership data when the host registry cannot be measured: %j",
      async (options) => {
        const f = fixture(options);
        const before = f.machine.toJSON();

        await expect(execute(f.remove, NATIVE_REF)).rejects.toThrow(/unavailable|still enabled/);

        expect(f.activator.uninstalledPlugins).toStrictEqual([]);
        expect(f.repo.saveCount).toBe(0);
        expect(f.machine.toJSON()).toStrictEqual(before);
      }
    );

    it.each(["missing", "duplicate"] as const)(
      "refuses a %s exact catalogue proof before unregistering",
      async (mode) => {
        const f = fixture();
        f.machine.setNativeRegistrations(toolId, {
          binary: toolId,
          marketplaces:
            mode === "missing"
              ? []
              : [
                  {
                    alias: "first",
                    hostName: "real-catalog",
                    provenance: nativeSourceFor(toolId, "real-catalog"),
                  },
                  {
                    alias: "second",
                    hostName: "real-catalog",
                    provenance: nativeSourceFor(toolId, "real-catalog"),
                  },
                ],
          pluginRefs: [NATIVE_REF],
          pluginClaims: [{ ref: NATIVE_REF, dependents: [] }],
        });
        const before = f.machine.toJSON();

        await expect(execute(f.remove, NATIVE_REF)).rejects.toThrow(
          /exact canonical catalogue source proof/
        );

        expect(f.activator.uninstalledPlugins).toStrictEqual([]);
        expect(f.repo.saveCount).toBe(0);
        expect(f.machine.toJSON()).toStrictEqual(before);
      }
    );

    it("reads dependents inside the repository's exclusive-access boundary", async () => {
      const f = fixture();
      let acquired = false;
      Object.assign(f.repo, {
        withExclusiveAccess: async (operation: () => Promise<void>) => {
          acquired = true;
          f.machine.setNativeRegistrations(toolId, {
            binary: toolId,
            marketplaces: [
              {
                alias: "real-catalog",
                hostName: "real-catalog",
                provenance: nativeSourceFor(toolId, "real-catalog"),
              },
            ],
            pluginRefs: [NATIVE_REF],
            pluginClaims: [{ ref: NATIVE_REF, dependents: ["/B"] }],
          });
          return operation();
        },
      });

      await expect(execute(f.remove, NATIVE_REF)).rejects.toThrow(saying(/active projects.*\/B/));

      expect(acquired).toBe(true);
      expect(f.activator.uninstalledPlugins).toStrictEqual([]);
      expect(f.repo.saveCount).toBe(0);
      expect(f.machine.getNativeRegistrations(toolId)?.pluginClaims).toStrictEqual([
        { ref: NATIVE_REF, dependents: ["/B"] },
      ]);
    });

    it("uses user scope when the enabled host ref has no scope label", async () => {
      const f = fixture({ hostRefs: new Map([[NATIVE_REF, { enabled: true }]]) });

      await execute(f.remove, NATIVE_REF);

      expect(f.activator.uninstalledPlugins).toStrictEqual([NATIVE_REF]);
      expect(f.activator.uninstalledPluginScopes).toStrictEqual(["user"]);
      expect(f.machine.getNativeRegistrations(toolId)?.pluginClaims).toStrictEqual([]);
      expect(f.repo.saveCount).toBe(1);
    });

    it("refuses B's live exact claim before contacting the host", async () => {
      const f = fixture({ dependents: ["/B"] });
      await expect(execute(f.remove, NATIVE_REF)).rejects.toThrow(
        saying(/user-scope plugin 'test-plugin@real-catalog': active projects.*\/B/)
      );
      expect(f.activator.uninstalledPlugins).toEqual([]);
      expect(
        claimsRecorded(f.repo.getCurrent()?.getNativeRegistrations(toolId))[0]?.dependents
      ).toEqual(["/B"]);
    });

    it("requires an exact ref when names collide across catalogues", async () => {
      const f = fixture({ refs: [NATIVE_REF, OTHER_NATIVE_REF] });
      await expect(execute(f.remove, "test-plugin")).rejects.toThrow(/multiple catalogues.*exact/);
      expect(f.activator.uninstalledPlugins).toEqual([]);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toHaveLength(2);
    });

    it("resolves a bare native plugin name when exactly one owned catalogue matches", async () => {
      const f = fixture();
      await execute(f.remove, "test-plugin");
      expect(f.activator.uninstalledPlugins).toEqual([NATIVE_REF]);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([]);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginRefs).toEqual([]);
    });

    it("never adopts a foreign preexisting host ref without a canonical claim", async () => {
      const f = fixture({
        refs: [],
        hostRefs: new Map([[NATIVE_REF, { enabled: true, scope: "user" as const }]]),
      });
      await expect(execute(f.remove, NATIVE_REF)).rejects.toThrow(saying(/not installed/i));
      expect(f.activator.uninstalledPlugins).toEqual([]);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([]);
    });

    it("refuses an unavailable host CLI or disabled host ref and retains the claim", async () => {
      for (const options of [
        { available: false },
        { hostRefs: new Map([[NATIVE_REF, { enabled: false, scope: "user" as const }]]) },
        { hostRefs: new Map([[OTHER_NATIVE_REF, { enabled: true, scope: "user" as const }]]) },
      ]) {
        const f = fixture(options);
        await expect(execute(f.remove, NATIVE_REF)).rejects.toThrow(/unavailable|still enabled/);
        expect(f.activator.uninstalledPlugins).toEqual([]);
        expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([
          { ref: NATIVE_REF, dependents: [] },
        ]);
      }
    });

    it("retains the machine claim if the host refuses unregister", async () => {
      const f = fixture({ failOnUninstall: true });
      await expect(execute(f.remove, NATIVE_REF)).rejects.toThrow(
        expect.objectContaining({ detail: expect.stringMatching(/not installed/) })
      );
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([
        { ref: NATIVE_REF, dependents: [] },
      ]);
    });

    it("refuses to uninstall an enabled native ref when its host catalogue source changed", async () => {
      const f = fixture({ sourceMismatch: true });
      await expect(execute(f.remove, NATIVE_REF)).rejects.toThrow(/source differs|source.*changed/);
      expect(f.activator.uninstalledPlugins).toEqual([]);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([
        { ref: NATIVE_REF, dependents: [] },
      ]);
    });

    it("refuses no source reader and legacy unproven source instead of trusting an enabled ref", async () => {
      for (const options of [{ sourceUnavailable: true }, { legacy: true }]) {
        const f = fixture(options);
        await expect(execute(f.remove, NATIVE_REF)).rejects.toThrow(
          /source reader unavailable|legacy claim/
        );
        expect(f.activator.uninstalledPlugins).toEqual([]);
        expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([
          { ref: NATIVE_REF, dependents: [] },
        ]);
      }
    });

    it("writes the record the host rewrote once the claimed ref is unregistered", async () => {
      const spy = spiedRecordRules();
      const f = fixture({ records: spy.rules });
      const before = structuredClone(f.machine.getNativeRegistrations(toolId));
      await execute(f.remove, NATIVE_REF);
      expect(spy.withoutClaimedRef).toHaveBeenCalledExactlyOnceWith(before, NATIVE_REF);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)).toStrictEqual({
        ...before,
        binary: REWRITTEN_BINARY,
      });
    });

    it("unregisters only the exact host ref and removes only its machine projection", async () => {
      const f = fixture({ refs: [NATIVE_REF, OTHER_NATIVE_REF] });
      await execute(f.remove, NATIVE_REF);
      expect(f.activator.uninstalledPlugins).toEqual([NATIVE_REF]);
      expect(f.activator.uninstalledPluginScopes).toEqual(["user"]);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([
        { ref: OTHER_NATIVE_REF, dependents: [] },
      ]);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginRefs).toEqual([
        OTHER_NATIVE_REF,
      ]);
    });

    it("passes the host's actual project-labelled ref scope to uninstall", async () => {
      const f = fixture({
        hostRefs: new Map([[NATIVE_REF, { enabled: true, scope: "project" as const }]]),
      });
      await execute(f.remove, NATIVE_REF);
      expect(f.activator.uninstalledPlugins).toEqual([NATIVE_REF]);
      expect(f.activator.uninstalledPluginScopes).toEqual(["project"]);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([]);
    });
  });
}
