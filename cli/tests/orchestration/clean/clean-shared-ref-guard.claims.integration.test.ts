/** At a host that enables a plugin machine-wide (no `NativeActivation.scopeArgs` - codex,
 * copilot), a ref is left enabled while another project still references its shared source. */

import { describe, expect, it } from "vitest";
import { UpdateGitignore } from "../../../src/contexts/installation/application/update-gitignore.use-case.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { UserSourceReferencesAdapter } from "../../../src/contexts/machine-claims/infrastructure/user-source-references-adapter.js";
import type { Scope } from "../../../src/shared/domain/scope.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import {
  SECOND_SYNTHETIC_TOOL,
  SYNTHETIC_TOOL,
  syntheticCatalog,
} from "../../shared/testing/synthetic-tool-id.builder.js";
import {
  buildUseCase,
  OTHER_PROJECT,
  OTHER_PROJECT_BYTES,
  PROJECT_ROOT,
  provenRegistration,
  seedManifest,
  seedReferences,
  seedSharedMarketplaceRegistry,
  USER_CONFIG_DIR,
} from "../testing/clean-shared-ref-guard.builder.js";

describe("clean releases a project's claims only once its local cleanup succeeds", () => {
  it.each(["succeeds", "fails"] as const)(
    "releases A's native and user-plugin claims only when local cleanup %s",
    async (outcome) => {
      const fs = new InMemoryFileAdapter();
      seedReferences(fs, [OTHER_PROJECT]);
      const ref = "aidd-vcs@aidd-framework";
      const otherRef = "plugin-b@other-mkt";
      const registration = provenRegistration(SYNTHETIC_TOOL, "aidd-framework", "aidd-framework");
      const project = seedManifest(SYNTHETIC_TOOL, [registration], [ref]);
      project.addTool(SECOND_SYNTHETIC_TOOL, "1.0.0", []);
      const record = (name: string, scope: Scope = "user") =>
        RecordedPlugin.fromJSON({
          name,
          source: { kind: "local", path: "/shared/plugins" },
          version: "1.0.0",
          strict: false,
          scope,
          files: {},
          dependents: [PROJECT_ROOT, OTHER_PROJECT],
        });
      project.addPlugin(SECOND_SYNTHETIC_TOOL, record("shared").withMachineClaim([]));
      project.addPlugin(
        SECOND_SYNTHETIC_TOOL,
        record("local-only", "project").withMachineClaim([])
      );
      const machine = Manifest.create();
      machine.addTool(SYNTHETIC_TOOL, "1.0.0", []);
      machine.setNativeRegistrations(SYNTHETIC_TOOL, {
        binary: SYNTHETIC_TOOL,
        marketplaces: [registration, provenRegistration(SYNTHETIC_TOOL, "other-mkt", "other-mkt")],
        pluginRefs: [ref, otherRef],
        pluginClaims: [ref, otherRef].map((ref) => ({
          ref,
          dependents: [PROJECT_ROOT, OTHER_PROJECT],
        })),
      });
      machine.addTool(SECOND_SYNTHETIC_TOOL, "1.0.0", []);
      for (const name of ["shared", "local-only", "unrelated"])
        machine.addPlugin(SECOND_SYNTHETIC_TOOL, record(name));
      const machineRepo = new InMemoryManifestRepository(machine);
      const gitignore = new UpdateGitignore(fs);
      if (outcome === "fails")
        gitignore.remove = async () => {
          throw new Error("gitignore cleanup failed");
        };
      fs.setFile(`${OTHER_PROJECT}/plugin-content.md`, OTHER_PROJECT_BYTES);
      const sharedPath = "/fake-home/.cursor/plugins/local/shared/skills/demo.md";
      fs.setFile(sharedPath, "shared plugin bytes");
      const activator = new FakeHostActions({ available: true });
      const useCase = buildUseCase({
        tools: syntheticCatalog(),
        fs,
        manifest: project,
        activator,
        binary: SYNTHETIC_TOOL,
        logger: new CapturingLogger(),
        aiddMarketplaceRegistry: seedSharedMarketplaceRegistry(),
        userManifestRepo: machineRepo,
        gitignore,
      });

      if (outcome === "fails")
        await expect(
          useCase.execute({
            projectRoot: PROJECT_ROOT,
            force: true,
          })
        ).rejects.toThrow("gitignore cleanup failed");
      else
        await useCase.execute({
          projectRoot: PROJECT_ROOT,
          force: true,
        });

      const dependents = outcome === "succeeds" ? [OTHER_PROJECT] : [PROJECT_ROOT, OTHER_PROJECT];
      expect(
        machineRepo.getCurrent()?.getNativeRegistrations(SYNTHETIC_TOOL)?.pluginClaims
      ).toEqual([
        { ref, dependents },
        { ref: otherRef, dependents: [PROJECT_ROOT, OTHER_PROJECT] },
      ]);
      expect(machineRepo.getCurrent()?.getNativeRegistrations(SYNTHETIC_TOOL)?.pluginRefs).toEqual([
        ref,
        otherRef,
      ]);
      expect(
        machineRepo
          .getCurrent()
          ?.getRecordedPlugins(SECOND_SYNTHETIC_TOOL)
          .map((plugin) => ({
            name: plugin.plugin.name,
            dependents: plugin.machineClaim,
          }))
      ).toEqual([
        { name: "shared", dependents },
        { name: "local-only", dependents: [PROJECT_ROOT, OTHER_PROJECT] },
        { name: "unrelated", dependents: [PROJECT_ROOT, OTHER_PROJECT] },
      ]);
      expect(
        await new UserSourceReferencesAdapter(
          fs,
          () => USER_CONFIG_DIR
        ).listAllReferencingProjects()
      ).toEqual(dependents);
      expect(fs.getFile(`${OTHER_PROJECT}/plugin-content.md`)).toBe(OTHER_PROJECT_BYTES);
      expect(fs.getFile(sharedPath)).toBe("shared plugin bytes");
      expect(activator.uninstalledPlugins).toEqual([]);
      expect(activator.removedMarketplaces).toEqual([]);
    }
  );
});
