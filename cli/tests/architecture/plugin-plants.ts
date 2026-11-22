/** The files planted to watch each Grit plugin of `biome-plugins/` bite, or spare what it allows. */
import type { Plant } from "./biome-plants.js";

const githubUrl = 'export const url = "https://api.github.com/repos/a/b/releases";\n';
const OUTSIDE_AUTH = "src/contexts/update/infrastructure";

export const PLUGIN_PLANTS: readonly Plant[] = [
  // A swallowed catch, with and without the ignore that says why.
  ["src/shared/domain/swallows.ts", "try { f(); } catch {}", "plugin", 1],
  ["tests/shared/domain/swallows.ts", "try { f(); } catch (e) { /* later */ }", "plugin", 1],
  [
    "tests/shared/domain/best-effort.ts",
    "// biome-ignore lint/plugin: why\ntry { f(); } catch {}",
    "plugin",
    0,
  ],
  // A GitHub API URL is written by the GitHub adapter only.
  ["src/contexts/update/infrastructure/builds-github-url.ts", githubUrl, "plugin", 1],
  [
    "src/shared/infrastructure/github-adapter.ts",
    `// biome-ignore lint/plugin: the one place the GitHub API base is written\n${githubUrl}`,
    "plugin",
    0,
  ],
  // Only the auth context reads the token variable; a sentence naming it stays.
  [`${OUTSIDE_AUTH}/reads.ts`, "export const t = process.env.AIDD_TOKEN;\n", "plugin", 1],
  [`${OUTSIDE_AUTH}/names.ts`, 'export const n = "AIDD_TOKEN";\n', "plugin", 1],
  [`${OUTSIDE_AUTH}/uses.ts`, "export const n = TOKEN_VARIABLE;\n", "plugin", 1],
  [
    "src/contexts/auth/infrastructure/reads.ts",
    "export const t = process.env.AIDD_TOKEN;\n",
    "plugin",
    0,
  ],
  ["src/presentation/errors/says.ts", 'export const h = "Set AIDD_TOKEN, run it";\n', "plugin", 0],
  // A type alias of a closed-folder type, imported into the shared test kit, is the same hand-back.
  [
    "tests/shared/testing/aliases.ts",
    'import type { R as Reader } from "../../../src/contexts/b/ports/r.js";\nexport type R = Reader;',
    "plugin",
    1,
  ],
  [
    "tests/shared/testing/aliases-contract.ts",
    'import type { R as Reader } from "../../../src/contexts/b/contract/r.js";\nexport type R = Reader;',
    "plugin",
    0,
  ],
  [
    "tests/shared/testing/aliases-local.ts",
    'import type { R } from "../../../src/contexts/b/ports/r.js";\nexport type Own = Array<R>;',
    "plugin",
    0,
  ],
];
