import { readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { TranslateDistribution } from "../../../../src/contexts/translate/application/translate-distribution.js";
import { translate } from "../../../../src/contexts/translate/domain/engine.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import {
  registeredManifestPaths,
  registeredManifestProbes,
} from "../../../shared/testing/registered-manifest-probes.builder.js";
import { registeredTools } from "../../../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../../../shared/testing/seed-from-directory.builder.js";
import {
  distributionOf,
  FRAMEWORK_SOURCE,
} from "../testing/framework-real-distribution.builder.js";

const tools = registeredTools();
const CELLS = tools
  .idsInCanonicalOrder("ai")
  .filter((id) => tools.aiProfile(id).plugins() !== null);

describe("an install's translation against the engine's install layout", () => {
  let tree: InMemoryFileAdapter;
  beforeAll(async () => {
    tree = new InMemoryFileAdapter();
    await seedFromDirectory(tree, FRAMEWORK_SOURCE, { useAbsolutePaths: true });
  });

  it.each(CELLS)("%s: every plugin translates to what the engine lists", (id) => {
    const tool = tools.aiProfile(id);
    const install = new TranslateDistribution(registeredManifestProbes());
    const plugins = readdirSync(join(FRAMEWORK_SOURCE, "plugins"));
    for (const name of plugins) {
      const distribution = distributionOf(tree, name);
      const engine = translate(distribution, {
        kind: "install",
        tool,
        manifestPaths: registeredManifestPaths(),
      });

      expect(install.execute({ distribution, tool }), name).toEqual({
        files: engine.files,
        componentPaths: engine.componentPaths,
        flatHookPaths: engine.flatHookPaths,
        skipped: engine.skipped,
        notices: engine.notices,
      });
    }
  });
});
