import { describe, expect, it } from "vitest";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { FakeHostActions } from "../../../../shared/testing/fake-host-actions.fake.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { FakeHostPluginRegistry } from "../../testing/fake-host-plugin-registry.fake.js";
import {
  installViaModeA,
  PLUGIN_NAME,
  REF,
  verifiedSourceReader,
} from "../../testing/framework-plugin-on-claude.builder.js";
import { pluginRemover } from "../../testing/plugin-remover.builder.js";
import { REWRITTEN_BINARY, spiedRecordRules } from "../../testing/spy-record-rules.fake.js";

const { claude } = TOOL;
const PROJECT_ROOT = "/test-project";

describe("the record a project plugin removal writes", () => {
  it("writes the record the host rewrote once the project ref is detached", async () => {
    const spy = spiedRecordRules();
    const manifest = Manifest.create();
    manifest.addTool(claude, "test", []);
    const repo = new InMemoryManifestRepository(manifest);
    await installViaModeA(manifest, repo.records);
    const before = structuredClone(repo.records.get(claude));
    const remove = pluginRemover({
      manifestRepo: repo,
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
      pluginName: PLUGIN_NAME,
      toolIds: [claude],
      projectRoot: PROJECT_ROOT,
    });

    expect(spy.withoutRef).toHaveBeenCalledExactlyOnceWith(before, REF);
    expect(repo.records.get(claude)).toStrictEqual({
      ...before,
      binary: REWRITTEN_BINARY,
    });
  });
});
