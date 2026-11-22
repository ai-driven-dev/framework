import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { RemoveProjectPlugin } from "../../../src/contexts/installation/application/removal/remove-project-plugin.js";
import { RecordedPlugin } from "../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { aManifest } from "../../contexts/installation/testing/manifest.builder.js";
import {
  REWRITTEN_BINARY,
  spiedRecordRules,
} from "../../contexts/installation/testing/spy-record-rules.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { KeepPrompter } from "../../shared/testing/scripted-prompter.fake.js";
import {
  SYNTHETIC_TOOL,
  syntheticCatalog,
} from "../../shared/testing/synthetic-tool-id.builder.js";
import { projectMarketplaceRemover } from "../testing/project-marketplace-remover.builder.js";

const PROJECT_ROOT = "/test-project";
const EPOCH = "1970-01-01T00:00:00.000Z";

describe("the record a project marketplace removal writes", () => {
  it("writes the record the host rewrote once an orphan's ref is detached", async () => {
    const spy = spiedRecordRules();
    const fs = new InMemoryFileAdapter();
    const manifestRepo = new InMemoryManifestRepository();
    const registry = new InMemoryMarketplaceRegistry();
    const useCase = projectMarketplaceRemover(
      syntheticCatalog(),
      new RemoveProjectPlugin(fs, () => "/home/dev"),
      manifestRepo,
      registry,
      new KeepPrompter(),
      spy.rules
    );
    const manifest = aManifest()
      .withTool(SYNTHETIC_TOOL, [])
      .withPlugin(
        SYNTHETIC_TOOL,
        RecordedPlugin.fromMetadata({
          name: "sample",
          version: "1.0.0",
          source: { kind: "github", repo: "owner/sample" },
          strict: false,
          scope: "project",
          marketplace: "awesome",
        })
      )
      .build();
    manifestRepo.records.set(SYNTHETIC_TOOL, {
      binary: SYNTHETIC_TOOL,
      marketplaces: [{ alias: "awesome", hostName: "host-awesome" }],
      pluginRefs: ["sample@host-awesome"],
    });
    await manifestRepo.save(manifest);
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "awesome",
        source: { kind: "github", repo: "owner/awesome" },
        scope: "project",
        addedAt: EPOCH,
      })
    );
    const before = structuredClone(manifestRepo.records.get(SYNTHETIC_TOOL));

    await useCase.execute({
      name: "awesome",
      projectRoot: PROJECT_ROOT,
      autoConfirm: true,
    });

    expect(spy.withoutRef).toHaveBeenCalledExactlyOnceWith(before, "sample@host-awesome");
    expect(manifestRepo.records.get(SYNTHETIC_TOOL)).toStrictEqual({
      ...before,
      binary: REWRITTEN_BINARY,
    });
  });
});
