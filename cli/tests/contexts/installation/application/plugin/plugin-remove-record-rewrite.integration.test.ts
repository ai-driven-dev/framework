import { describe, expect, it } from "vitest";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import {
  installViaModeA,
  PLUGIN_NAME,
  REF,
  verifiedSourceReader,
} from "../../../../helpers/framework-plugin-on-claude.js";
import { pluginRemover } from "../../../../helpers/plugin-remover.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";
import { REWRITTEN_BINARY, spiedRecordRules } from "../../../../helpers/spy-record-rules.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.js";
import { FakeHostActions } from "../../testing/fake-host-actions.js";
import { FakeHostPluginRegistry } from "../../testing/fake-host-plugin-registry.js";

const { claude } = TOOL;
const PROJECT_ROOT = "/test-project";

describe("the record a project plugin removal writes", () => {
  it("writes the record the host rewrote once the project ref is detached", async () => {
    const spy = spiedRecordRules();
    const manifest = Manifest.create();
    manifest.addTool(claude, "test", []);
    await installViaModeA(manifest);
    const before = structuredClone(manifest.getNativeRegistrations(claude));
    const remove = pluginRemover({
      manifestRepo: new InMemoryManifestRepository(manifest),
      activators: new Map([[claude, new FakeHostActions({ available: true })]]),
      hostPluginRegistries: new Map([
        [
          claude,
          new FakeHostPluginRegistry({
            location: "/host/registry",
            refs: new Map([[REF, { enabled: true, scope: "project" }]]),
          }),
        ],
      ]),
      nativeMarketplaceSources: new Map([[claude, verifiedSourceReader()]]),
      records: spy.rules,
    });

    await remove.execute({
      tools: registeredTools(),
      pluginName: PLUGIN_NAME,
      toolIds: [claude],
      projectRoot: PROJECT_ROOT,
    });

    expect(spy.withoutRef).toHaveBeenCalledExactlyOnceWith(before, REF);
    expect(manifest.getNativeRegistrations(claude)).toStrictEqual({
      ...before,
      binary: REWRITTEN_BINARY,
    });
  });
});
