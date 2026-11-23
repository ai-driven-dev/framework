/**
 * The files `biome-guards-bite.arch.test.ts` plants in a throwaway tree: one row per file, naming
 * the rule that must fire on it and how many times. `times` 0 is a file the rule must spare.
 */
import { PLUGIN_PLANTS } from "./plugin-plants.js";

const IMPORT = "lint/style/noRestrictedImports";
const GLOBAL = "lint/style/noRestrictedGlobals";
const FILE_NAME = "lint/style/useFilenamingConvention";
const IMPORT_TYPE = "lint/style/useImportType";
const FLOATING = "lint/nursery/noFloatingPromises";
const PROFILE_MODULE = "../../../tools/contract/tool-profile.js";
const OF_INSTALLATION = "tests/contexts/installation/application";
const TOOLS = "../../../../src/contexts/tools";
const APPLICATION = "src/contexts/installation/application";
const BARE_NODE_MODULES = ["fs", "fs/promises", "node:fs/promises", "child_process"];

export type Plant = readonly [path: string, source: string, rule: string, times: number];

const exits = "export const stop = (): never => process.exit(1);\n";
const readsEnv = "export const home = (): string | undefined => process.env.HOME;\n";
const imports = (specifier: string): string =>
  `import * as mod from "${specifier}";\nexport const used = mod;\n`;
const reaches = (specifier: string): string =>
  `import type { X } from "${specifier}";\nexport type Reached = X;\n`;
const defaults = "const value = 1;\nexport default value;\n";

const AUTH_FOLDERS = ["domain", "ports", "application", "infrastructure", "contract"] as const;
const AUTH_FILES: Readonly<Record<(typeof AUTH_FOLDERS)[number], string>> = {
  domain: "credential-record",
  ports: "identity-verifier",
  application: "log-in",
  infrastructure: "gh-cli-adapter",
  contract: "credential",
};
/** Only auth's contract and application are public: every other folder of it is interior. */
const AUTH_PUBLIC: ReadonlySet<string> = new Set(["contract", "application"]);
const DISTRIBUTION_LAYERS = ["contract", "domain", "ports", "application", "infrastructure"];
const ASKS_FOR_THE_PROMPTER = ["application", "infrastructure"];

/** `times` is how many diagnostics of `rule` the planted file must draw; 0 is a file the rule spares. */
export const PLANTS: readonly Plant[] = [
  ...PLUGIN_PLANTS,
  ["src/contexts/auth/ports/token-reader.port.ts", "export class TokenReader {}\n", "plugin", 1],
  [
    "src/contexts/auth/ports/token-name.port.ts",
    'export const TOKEN_NAME = "token";\n',
    "plugin",
    1,
  ],
  [
    "src/contexts/auth/ports/token-source.port.ts",
    "export interface TokenSource {\n  read(): string;\n}\nexport type TokenKind = string;\n",
    "plugin",
    0,
  ],
  ["src/contexts/auth/ports/token-store.ts", "export class TokenStore {}\n", "plugin", 0],
  ["src/shared/domain/re-exports.ts", 'export type { A } from "./a.js";', "plugin", 1],
  [
    "tests/shared/testing/launders.ts",
    'export { x } from "../../src/contexts/b/domain/m.js";',
    "plugin",
    1,
  ],
  [
    "tests/shared/testing/publishes.ts",
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
  ["src/presentation/lists.ts", "export type L = readonly AiToolProfile[];", "plugin", 1],
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

  // process.exit: shared, contexts and presentation never call it; the composition root does.
  ["src/shared/domain/exit.ts", exits, "plugin", 1],
  ["src/shared/infrastructure/exit.ts", exits, "plugin", 1],
  ["src/presentation/controllers/exit.controller.ts", exits, "plugin", 1],
  ["src/presentation/project-root.ts", exits, "plugin", 1],
  ["src/presentation/terminal/inquirer-prompter.adapter.ts", exits, "plugin", 1],
  // export default, under src/ and tests/ alike.
  ["src/shared/domain/default.ts", defaults, "lint/style/noDefaultExport", 1],
  ["tests/shared/domain/default.ts", defaults, "lint/style/noDefaultExport", 1],
  ["src/shared/domain/clean.ts", "export const one = 1;\n", "lint/style/noDefaultExport", 0],
  // A file is named in kebab-case, each dot-separated part.
  ["src/shared/domain/BadName.ts", "export const one = 1;\n", FILE_NAME, 1],
  ["src/shared/domain/bad_name.ts", "export const one = 1;\n", FILE_NAME, 1],
  ["tests/shared/domain/good-name.unit.test.ts", "export const one = 1;\n", FILE_NAME, 0],
  [
    "src/shared/domain/value-as-type.ts",
    'import { Thing } from "./thing.js";\nexport const take = (x: Thing): Thing => x;\n',
    IMPORT_TYPE,
    1,
  ],
  // The process global, in the layers that hold no I/O.
  ["src/contexts/installation/domain/env.ts", readsEnv, GLOBAL, 1],
  ["src/contexts/installation/application/env.ts", readsEnv, GLOBAL, 1],
  ["src/contexts/installation/infrastructure/env.ts", readsEnv, GLOBAL, 0],
  ["src/contexts/auth/ports/env.ts", readsEnv, GLOBAL, 1],
  ["src/contexts/auth/contract/env.ts", readsEnv, GLOBAL, 1],
  ["src/shared/ports/env.ts", readsEnv, GLOBAL, 1],
  ["src/shared/domain/env.ts", readsEnv, GLOBAL, 1],
  // shared reaches no context, and the composition root only wires.
  [
    "src/shared/ports/reaches-context.ts",
    reaches("../../contexts/tools/domain/registry.js"),
    IMPORT,
    1,
  ],
  [
    "src/shared/infrastructure/reaches-context.ts",
    reaches("../../contexts/tools/domain/registry.js"),
    IMPORT,
    1,
  ],
  [
    "src/shared/domain/reaches-context.ts",
    reaches("../../contexts/tools/domain/registry.js"),
    IMPORT,
    1,
  ],
  [
    "src/contexts/tools/infrastructure/reaches-shared.ts",
    reaches("../../../shared/infrastructure/http-client.js"),
    IMPORT,
    1,
  ],
  [
    "src/presentation/presenters/reaches-shared.presenter.ts",
    reaches("../../shared/infrastructure/http-client.js"),
    IMPORT,
    1,
  ],
  [
    "src/composition/reaches-shared.ts",
    reaches("../shared/infrastructure/http-client.js"),
    IMPORT,
    0,
  ],
  ["src/cli.ts", reaches("./shared/infrastructure/http-client.js"), IMPORT, 1],
  [
    "src/contexts/tools/domain/reaches-composition.ts",
    reaches("../../../composition/shared.js"),
    IMPORT,
    1,
  ],
  ["src/shared/domain/reaches-composition.ts", reaches("../../composition/shared.js"), IMPORT, 1],
  [
    "src/shared/infrastructure/reaches-composition.ts",
    reaches("../../composition/shared.js"),
    IMPORT,
    1,
  ],
  [
    "src/presentation/presenters/reaches-composition.presenter.ts",
    reaches("../../composition/shared.js"),
    IMPORT,
    1,
  ],
  ["src/composition/reaches-composition.ts", reaches("../composition/shared.js"), IMPORT, 0],
  // A context nothing admits does not reach auth, auth reaches no context, distribution may reach auth.
  [
    "src/contexts/tools/domain/reaches-auth.ts",
    reaches("../../auth/contract/token-provider.js"),
    IMPORT,
    1,
  ],
  [
    "src/contexts/auth/domain/reaches-tools.ts",
    reaches("../../tools/domain/registry.js"),
    IMPORT,
    1,
  ],
  [
    "src/contexts/distribution/infrastructure/reaches-auth.ts",
    reaches("../../auth/contract/token-provider.js"),
    IMPORT,
    0,
  ],
  // recipes and installation never meet; presentation reaches recipes through its commands only.
  [
    "src/contexts/recipes/domain/reaches-installation.ts",
    reaches("../../installation/domain/registry.js"),
    IMPORT,
    1,
  ],
  [
    "src/contexts/installation/application/reaches-recipes.ts",
    reaches("../../recipes/application/validate-recipes.js"),
    IMPORT,
    1,
  ],
  [
    "src/presentation/presenters/reaches-recipes-domain.presenter.ts",
    reaches("../../contexts/recipes/domain/x.js"),
    IMPORT,
    1,
  ],
  [
    "src/presentation/presenters/reaches-recipes-application.presenter.ts",
    reaches("../../contexts/recipes/application/x.js"),
    IMPORT,
    0,
  ],
  // update runs a process and recipes reads the disk in infrastructure, never in application.
  [
    "src/contexts/update/application/spawns.ts",
    'import { execSync } from "node:child_process";\nexport const run = execSync;\n',
    IMPORT,
    1,
  ],
  [
    "src/contexts/update/infrastructure/spawns.ts",
    'import { execSync } from "node:child_process";\nexport const run = execSync;\n',
    IMPORT,
    0,
  ],
  ["src/contexts/recipes/application/reads.ts", imports("node:fs"), IMPORT, 1],
  ["src/contexts/recipes/infrastructure/reads.ts", imports("node:fs"), IMPORT, 0],
  // A pure folder takes no package and no builtin but path and crypto.
  ...(
    [
      ["src/contexts/auth/domain/pure/imports-fs.ts", "node:fs", 1],
      ["src/contexts/auth/domain/pure/imports-os.ts", "node:os", 1],
      ["src/contexts/auth/domain/pure/imports-commander.ts", "commander", 1],
      ["src/contexts/auth/domain/pure/imports-bare-fs.ts", "fs", 1],
      ["src/contexts/auth/domain/pure/imports-path.ts", "node:path", 0],
      ["src/contexts/auth/domain/pure/imports-crypto.ts", "node:crypto", 0],
      ["src/contexts/auth/ports/imports-fs.ts", "node:fs", 1],
      ["src/contexts/auth/contract/imports-fs.ts", "node:fs", 1],
      ["src/contexts/recipes/domain/imports-fs.ts", "node:fs", 1],
      ["src/contexts/recipes/ports/imports-fs.ts", "node:fs", 1],
      ["src/shared/domain/imports-fs.ts", "node:fs", 1],
      ["src/shared/domain/imports-path.ts", "node:path", 0],
      ["src/shared/ports/imports-fs.ts", "node:fs", 1],
      ["src/shared/ports/imports-path.ts", "node:path", 0],
    ] as const
  ).map(([path, specifier, times]): Plant => [path, imports(specifier), IMPORT, times]),
  // Distribution reaches no installation and does not ask: it returns a result.
  ...DISTRIBUTION_LAYERS.map(
    (layer): Plant => [
      `src/contexts/distribution/${layer}/reaches-installation.ts`,
      reaches("../../../installation/x.js"),
      IMPORT,
      1,
    ]
  ),
  ...ASKS_FOR_THE_PROMPTER.map(
    (layer): Plant => [
      `src/contexts/distribution/${layer}/plant-prompter.ts`,
      reaches("../../../orchestration/ports/prompter.js"),
      IMPORT,
      1,
    ]
  ),
  // auth publishes its contract and application; presentation and the admitted contexts reach no more.
  ...AUTH_FOLDERS.flatMap((folder) =>
    (
      [
        ["src/presentation/presenters", "../../contexts/", AUTH_PUBLIC.has(folder) ? 0 : 1],
        ["src/composition", "../contexts/", 0],
        ["src/contexts/distribution/infrastructure", "../../", AUTH_PUBLIC.has(folder) ? 0 : 1],
        // An application reaching an infrastructure breaks the layer pattern and auth's interior.
        [
          "src/contexts/update/application",
          "../../",
          folder === "infrastructure" ? 2 : AUTH_PUBLIC.has(folder) ? 0 : 1,
        ],
      ] as const
    ).map(
      ([dir, up, times]): Plant => [
        `${dir}/reaches-auth-${folder}.ts`,
        reaches(`${up}auth/${folder}/${AUTH_FILES[folder]}.js`),
        IMPORT,
        times,
      ]
    )
  ),
  // orchestration reaches the contract and application of a context, nothing below, above or on disk.
  ...(
    [
      ["fs", "node:fs", 1],
      ["process", "node:child_process", 1],
      ["domain", "../../contexts/auth/domain/credential-record.js", 1],
      ["infrastructure", "../../contexts/auth/infrastructure/gh-cli-adapter.js", 1],
      ["contract", "../../contexts/auth/contract/credential.js", 0],
      ["application", "../../contexts/auth/application/log-in.js", 0],
      ["tools-application", "../../contexts/tools/application/x.js", 1],
      ["shared-infrastructure", "../../shared/infrastructure/http-client.js", 1],
      ["composition", "../../composition/shared.js", 1],
      ["presentation", "../../presentation/terminal/output.adapter.js", 1],
    ] as const
  ).map(
    ([name, specifier, times]): Plant => [
      `src/orchestration/setup/reaches-${name}.ts`,
      `import "${specifier}";\n`,
      IMPORT,
      times,
    ]
  ),
  [
    "src/orchestration/setup/reaches-bare.ts",
    BARE_NODE_MODULES.map((specifier) => `import "${specifier}";\n`).join(""),
    IMPORT,
    BARE_NODE_MODULES.length,
  ],
  // A unit test reads no disk and runs no process; an integration test may.
  [
    "tests/shared/domain/reads.unit.test.ts",
    'import { readFileSync } from "node:fs";\nexport const read = readFileSync;\n',
    IMPORT,
    1,
  ],
  [
    "tests/shared/domain/awaits.unit.test.ts",
    'import { readFile } from "node:fs/promises";\nexport const read = readFile;\n',
    IMPORT,
    1,
  ],
  [
    "tests/shared/domain/spawns.unit.test.ts",
    'export const load = () => import("node:child_process");\n',
    IMPORT,
    1,
  ],
  [
    "tests/shared/domain/homes.unit.test.ts",
    'import { homedir } from "node:os";\nexport const home = homedir;\n',
    IMPORT,
    1,
  ],
  [
    "tests/shared/domain/homes-bare.unit.test.ts",
    'import { homedir } from "os";\nexport const home = homedir;\n',
    IMPORT,
    1,
  ],
  [
    "tests/shared/domain/homes.integration.test.ts",
    'import { homedir } from "node:os";\nexport const home = homedir;\n',
    IMPORT,
    0,
  ],
  [
    "tests/shared/domain/reads.integration.test.ts",
    'import { readFileSync } from "node:fs";\nexport const read = readFileSync;\n',
    IMPORT,
    0,
  ],
  // A promise nobody awaits, returns or voids fails its error silently.
  [
    "src/shared/domain/floats.ts",
    "const load = async (): Promise<number> => 1;\nexport const run = async (): Promise<void> => {\n  load();\n};\n",
    FLOATING,
    1,
  ],
  [
    "src/shared/domain/awaits-promise.ts",
    "const load = async (): Promise<number> => 1;\nexport const run = async (): Promise<void> => {\n  await load();\n};\n",
    FLOATING,
    0,
  ],
];
