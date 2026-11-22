/**
 * What the install translation emits, per tool and per framework plugin: the sha256 of each
 * file plus the side results the installation reads. Keyed `<tool>/<plugin>`. Re-baselining a
 * cell is deliberate.
 */

import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  TranslateDistribution,
  type TranslateDistributionResult,
} from "../../src/contexts/translate/application/translate-distribution.use-case.js";
import {
  distributionOf,
  FRAMEWORK_SOURCE,
} from "../contexts/translate/testing/framework-real-distribution.builder.js";
import { InMemoryFileAdapter } from "../shared/testing/in-memory-file-adapter.fake.js";
import { manifestProbesOf } from "../shared/testing/manifest-probes-of.builder.js";
import { registeredTools } from "../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../shared/testing/seed-from-directory.builder.js";
import { expectGolden } from "./testing/expect-golden.builder.js";

const SNAPSHOT_FILE = join(process.cwd(), "tests/golden/snapshots/translate-install/golden.json");

const sha = (content: string) => createHash("sha256").update(content, "utf-8").digest("hex");

/** What a tool keeping its hooks in the project is handed to place; nothing to pin for any other. */
function projectHooksOf({ manifest, scripts }: TranslateDistributionResult["projectHooks"]) {
  if (manifest === null && scripts.length === 0) return {};
  return {
    projectHooks: {
      manifest: manifest === null ? null : sha(manifest),
      scripts: Object.fromEntries(scripts.map((file) => [file.relativePath, sha(file.content)])),
    },
  };
}

describe("Install translation golden", () => {
  let tree: InMemoryFileAdapter;
  beforeAll(async () => {
    tree = new InMemoryFileAdapter();
    await seedFromDirectory(tree, FRAMEWORK_SOURCE, { useAbsolutePaths: true });
  });

  it("every tool and framework plugin translates to its stored baseline", async () => {
    const translate = new TranslateDistribution(manifestProbesOf(registeredTools()));
    const catalog = registeredTools();
    const plugins = readdirSync(join(FRAMEWORK_SOURCE, "plugins")).sort();
    const captured: Record<string, unknown> = {};
    for (const id of catalog.idsInCanonicalOrder("ai")) {
      const tool = catalog.aiProfile(id);
      if (tool.plugins() === null) continue;
      for (const name of plugins) {
        const result = translate.execute({ distribution: distributionOf(tree, name), tool });
        captured[`${id}/${name}`] = {
          files: Object.fromEntries(
            result.files.map((file) => [file.relativePath, sha(file.content)]).sort()
          ),
          componentPaths: [...result.componentPaths].sort(),
          flatHookPaths: [...result.flatHookPaths].sort(),
          skipped: result.skipped,
          notices: result.notices,
          ...projectHooksOf(result.projectHooks),
        };
      }
    }
    expect(Object.keys(captured).length).toBeGreaterThan(30);
    await expectGolden(SNAPSHOT_FILE, captured);
  });
});
