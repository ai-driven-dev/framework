import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { RemoveProjectPlugin } from "../../../src/contexts/installation/application/removal/remove-project-plugin.js";
import { InstalledPlugin } from "../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { InMemoryManifestRepository } from "../../contexts/installation/testing/in-memory-manifest-repository.js";
import { aManifest } from "../../contexts/installation/testing/manifest-builder.js";
import {
  REWRITTEN_BINARY,
  spiedRecordRules,
} from "../../contexts/installation/testing/spy-record-rules.js";
import { InMemoryMarketplaceRegistry } from "../../helpers/ports/in-memory-marketplace-registry.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";
import { KeepPrompter } from "../../shared/testing/scripted-prompter.fake.js";
import { projectMarketplaceRemover } from "../testing/project-marketplace-remover.js";

const PROJECT_ROOT = "/test-project";
const EPOCH = "1970-01-01T00:00:00.000Z";

describe("the record a project marketplace removal writes", () => {
  it("writes the record the host rewrote once an orphan's ref is detached", async () => {
    const spy = spiedRecordRules();
    const fs = new InMemoryFileAdapter();
    const manifestRepo = new InMemoryManifestRepository();
    const registry = new InMemoryMarketplaceRegistry();
    const useCase = projectMarketplaceRemover(
      new RemoveProjectPlugin(fs),
      manifestRepo,
      registry,
      new KeepPrompter(),
      spy.rules
    );
    const manifest = aManifest()
      .withTool(TOOL.claude, [])
      .withPlugin(
        TOOL.claude,
        InstalledPlugin.fromMetadata(
          "sample",
          "1.0.0",
          { kind: "github", repo: "owner/sample" },
          false,
          "project",
          "awesome"
        )
      )
      .build();
    manifest.setNativeRegistrations(TOOL.claude, {
      binary: TOOL.claude,
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
    const before = structuredClone(manifest.getNativeRegistrations(TOOL.claude));

    await useCase.execute({
      name: "awesome",
      projectRoot: PROJECT_ROOT,
      autoConfirm: true,
    });

    expect(spy.withoutRef).toHaveBeenCalledExactlyOnceWith(before, "sample@host-awesome");
    expect((await manifestRepo.load())?.getNativeRegistrations(TOOL.claude)).toStrictEqual({
      ...before,
      binary: REWRITTEN_BINARY,
    });
  });
});
