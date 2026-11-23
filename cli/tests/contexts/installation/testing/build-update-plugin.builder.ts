import {
  UpdatePlugin,
  type UpdatePluginDeps,
} from "../../../../src/contexts/installation/application/plugin/update-plugin.use-case.js";
import {
  UpdateProjectPlugins,
  type UpdateProjectPluginsDeps,
} from "../../../../src/contexts/installation/application/plugin/update-project-plugins.use-case.js";
import type { ManifestRepository } from "../../../../src/contexts/installation/ports/manifest-repository.js";
import type { ToolCatalog } from "../../../../src/contexts/tools/contract/tool-catalog.js";
import { CapturingLogger } from "../../../shared/testing/capturing-logger.fake.js";
import { InMemoryManifestRepository } from "../../../shared/testing/in-memory-manifest-repository.fake.js";
import { FakeUserPluginMaterialization } from "./fake-user-plugin-materialization.fake.js";

/** An update of a project's plugins; the machine half is never reached. */
export function buildProjectPluginUpdate(
  deps: UpdateProjectPluginsDeps & { readonly manifestRepo: ManifestRepository },
  tools: ToolCatalog
): UpdatePlugin {
  const { manifestRepo, ...project } = deps;
  return new UpdatePlugin(
    {
      manifests: { project: manifestRepo, user: new InMemoryManifestRepository() },
      updateProject: new UpdateProjectPlugins(project),
      materializer: new FakeUserPluginMaterialization(),
      logger: new CapturingLogger(),
    },
    tools
  );
}

/** An update of the machine's plugins; the project half is never reached. */
export function buildMachinePluginUpdate(
  deps: Pick<UpdatePluginDeps, "materializer" | "logger"> & {
    readonly repo: UpdatePluginDeps["manifests"]["user"];
  },
  tools: ToolCatalog
): UpdatePlugin {
  const { repo, ...machine } = deps;
  return new UpdatePlugin(
    {
      ...machine,
      manifests: { project: new InMemoryManifestRepository(), user: repo },
      updateProject: {
        execute: () => Promise.reject(new Error("a machine update reaches no project plugin")),
      },
    },
    tools
  );
}
