/**
 * The rules biome holds for a test, a catch, a re-export and a tool profile are planted in one
 * tree and linted once: a rule biome silently stops applying is invisible, so each row names a
 * file, what it holds, the rule that must fire and how many times. A `times` of 0 is a file the
 * rule must spare. The last row is the one file two overrides could both match: it must draw both
 * of its diagnostics, since Biome keeps only the last matching override's options.
 */
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { biomeFindings, CLI_ROOT } from "./helpers.js";

const IMPORT = "lint/style/noRestrictedImports";
const PROFILE_MODULE = "../../../tools/contract/tool-profile.js";
const OF_INSTALLATION = "tests/contexts/installation/application";
const TOOLS = "../../../../src/contexts/tools";
const APPLICATION = "src/contexts/installation/application";

type Plant = readonly [path: string, source: string, rule: string, times: number];

/** `times` is how many diagnostics of `rule` the planted file must draw; 0 is a file the rule spares. */
const PLANTS: readonly Plant[] = [
  ["src/shared/domain/swallows.ts", "try { f(); } catch {}", "plugin", 1],
  ["tests/shared/domain/swallows.ts", "try { f(); } catch (e) { /* later */ }", "plugin", 1],
  [
    "tests/shared/domain/best-effort.ts",
    "// biome-ignore lint/plugin: why\ntry { f(); } catch {}",
    "plugin",
    0,
  ],
  ["src/shared/domain/re-exports.ts", 'export type { A } from "./a.js";', "plugin", 1],
  [
    "tests/helpers/launders.ts",
    'export { x } from "../../src/contexts/b/domain/m.js";',
    "plugin",
    1,
  ],
  [
    "tests/helpers/publishes.ts",
    'export { x } from "../../src/contexts/b/contract/m.js";',
    "plugin",
    0,
  ],
  [
    `${APPLICATION}/names.ts`,
    `import type { AiToolProfile } from "${PROFILE_MODULE}";`,
    "plugin",
    1,
  ],
  [
    `${APPLICATION}/sections.ts`,
    `import type { PluginAnswers } from "${PROFILE_MODULE}";`,
    "plugin",
    0,
  ],
  [`${APPLICATION}/space.ts`, `import type * as P from "${PROFILE_MODULE}";`, "plugin", 1],
  [
    "src/contexts/tools/domain/owns.ts",
    'import type { ToolProfile } from "../contract/tool-profile.js";',
    "plugin",
    0,
  ],
  [`${APPLICATION}/lists.ts`, "export type L = readonly AiToolProfile[];", "plugin", 1],
  ["src/presentation/lists.ts", "export type L = readonly AiToolProfile[];", "plugin", 0],
  [
    "tests/shared/domain/seeds.unit.test.ts",
    'import { seed } from "./seed-from-directory.js";',
    IMPORT,
    1,
  ],
  [
    "tests/shared/domain/seeds.integration.test.ts",
    'import { seed } from "./seed-from-directory.js";',
    IMPORT,
    0,
  ],
  [
    `${OF_INSTALLATION}/reaches.unit.test.ts`,
    `import { x } from "${TOOLS}/domain/x.js";`,
    IMPORT,
    1,
  ],
  [
    `${OF_INSTALLATION}/reaches.integration.test.ts`,
    `import { x } from "${TOOLS}/infrastructure/x.js";`,
    IMPORT,
    1,
  ],
  [
    `${OF_INSTALLATION}/publishes.integration.test.ts`,
    `import { x } from "${TOOLS}/contract/x.js";`,
    IMPORT,
    0,
  ],
  [
    "tests/contexts/installation/domain/own.integration.test.ts",
    'import { x } from "../../../../src/contexts/installation/domain/x.js";',
    IMPORT,
    0,
  ],
  [
    `${OF_INSTALLATION}/both.unit.test.ts`,
    `import "node:fs";\nimport { x } from "${TOOLS}/ports/x.js";`,
    IMPORT,
    2,
  ],
];

describe("every rule biome holds for a test is planted and fires, once per breach", () => {
  let findings: string[];
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "aidd-biome-plants-"));
    cpSync(join(CLI_ROOT, "biome.json"), join(root, "biome.json"));
    cpSync(join(CLI_ROOT, "biome-plugins"), join(root, "biome-plugins"), { recursive: true });
    for (const [path, source] of PLANTS) {
      mkdirSync(join(root, dirname(path)), { recursive: true });
      writeFileSync(join(root, path), `${source}\n`);
    }
    findings = biomeFindings(root);
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it.each(PLANTS)("%s draws its diagnostics", (path, _source, rule, times) => {
    expect(findings.filter((found) => found === `${path}:${rule}`)).toHaveLength(times);
  });
});
