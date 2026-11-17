import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { RemoveProjectPlugin } from "../../../src/contexts/installation/application/removal/remove-project-plugin.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { catalogOf, TOOL } from "../../contexts/tools/testing/catalog-of.js";
import { InMemoryFileAdapter } from "../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../helpers/ports/in-memory-manifest-repository.js";
import { InMemoryMarketplaceRegistry } from "../../helpers/ports/in-memory-marketplace-registry.js";
import { KeepPrompter } from "../../helpers/ports/scripted-prompter.js";
import { projectMarketplaceRemover } from "../../helpers/project-marketplace-remover.js";
import { REWRITTEN_BINARY, spiedRecordRules } from "../../helpers/spy-record-rules.js";

const PROJECT_ROOT = "/test-project";

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
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "1.0.0", []);
    manifest.addPlugin(
      TOOL.claude,
      InstalledPlugin.fromMetadata(
        "sample",
        "1.0.0",
        { kind: "github", repo: "owner/sample" },
        false,
        "project",
        "awesome"
      )
    );
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
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );
    const before = structuredClone(manifest.getNativeRegistrations(TOOL.claude));

    await useCase.execute({
      tools: catalogOf(),
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
