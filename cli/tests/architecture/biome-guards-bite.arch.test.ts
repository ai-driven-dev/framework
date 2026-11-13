/**
 * Three rules live in biome rather than here: `process.exit` below the command edge through the
 * GritQL plugin, `export default` under src/ and tests/, and the `process` global in a context's
 * domain and application. A rule biome silently stops applying is invisible, so each is planted.
 */
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CLI_ROOT, read } from "./helpers.js";

// The package's own node launcher: `.bin/biome` is a shell shim, a `.cmd` on Windows.
const BIOME = join(CLI_ROOT, "node_modules", "@biomejs", "biome", "bin", "biome");
const PLUGIN = "biome-plugins/no-process-exit.grit";

/** A file property as the GitHub reporter escapes it, `C:` written `C%3A` on Windows. */
function reportedFile(raw: string): string {
  return raw.replace(/%3A/gi, ":").replace(/%2C/gi, ",").replace(/%25/g, "%");
}

/** The diagnostics biome prints for one planted tree, as `<file>:<rule>` lines. */
function biomeFindings(projectDir: string, launcher = BIOME): string[] {
  const result = spawnSync(process.execPath, [launcher, "lint", "--reporter=github", "."], {
    cwd: projectDir,
    encoding: "utf8",
  });
  const findings = `${result.stdout}\n${result.stderr}`
    .split("\n")
    .map((line) => /^\s*::(?:error|warning) title=(\S+),file=(\S+?),/.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map(
      (match) =>
        `${relative(
          realpathSync(projectDir),
          realpathSync(resolve(projectDir, reportedFile(match[2] as string)))
        )
          .split(sep)
          .join("/")}:${match[1]}`
    )
    .sort();
  // biome exits 0 when clean and 1 with diagnostics; anything else never linted.
  if (result.status !== 0 && !(result.status === 1 && findings.length > 0)) {
    throw new Error(`biome did not run: ${result.error?.message ?? result.stderr}`);
  }
  return findings;
}

/** The folders that import nothing from the platform or a package but the two modules that
 * hold no I/O. */
const PURE_FOLDERS = [
  "src/contexts/auth/domain/**/*.ts",
  "src/contexts/auth/ports/**/*.ts",
  "src/contexts/auth/contract/**/*.ts",
  "src/contexts/recipes/domain/**/*.ts",
  "src/contexts/recipes/ports/**/*.ts",
  "src/shared/domain/**/*.ts",
  "src/shared/ports/**/*.ts",
] as const;
const PURE_BUILTINS: ReadonlySet<string> = new Set(["path", "crypto"]);

describe("biome carries the exit and default-export rules", () => {
  it("scopes the process.exit plugin to the layers that throw, and to nothing else", () => {
    const config = JSON.parse(read("biome.json")) as {
      overrides?: { includes?: string[]; plugins?: string[] }[];
    };
    const carrier = (config.overrides ?? []).find((o) => o.plugins?.includes(`./${PLUGIN}`));
    expect(carrier?.includes, `no override applies ${PLUGIN}`).toEqual([
      "src/shared/**",
      "src/contexts/**",
      "src/presentation/terminal/prompter-adapter.ts",
      "src/presentation/project-root.ts",
    ]);
  });

  it("bans the process global across every context's domain and application", () => {
    const config = JSON.parse(read("biome.json")) as {
      overrides?: {
        includes?: string[];
        linter?: { rules?: { style?: { noRestrictedGlobals?: { options?: unknown } } } };
      }[];
    };
    const carrier = (config.overrides ?? []).find(
      (o) => o.linter?.rules?.style?.noRestrictedGlobals !== undefined
    );

    expect(
      carrier?.includes,
      "no override denies the process global to a context's domain and application"
    ).toEqual([
      "src/contexts/*/domain/**/*.ts",
      "src/contexts/*/application/**/*.ts",
      "src/contexts/*/ports/**/*.ts",
      "src/contexts/*/contract/**/*.ts",
      "src/shared/ports/**/*.ts",
    ]);
  });

  it("denies a pure folder every package and every Node builtin but path and crypto", () => {
    const config = JSON.parse(read("biome.json")) as {
      overrides?: {
        includes?: string[];
        linter?: {
          rules?: { style?: { noRestrictedImports?: { options?: { paths?: object } } } };
        };
      }[];
    };
    const deniedBy = (includes: string): string[] => {
      const override = (config.overrides ?? []).find((o) => o.includes?.[0] === includes);
      return Object.keys(override?.linter?.rules?.style?.noRestrictedImports?.options?.paths ?? {});
    };
    const pkg = JSON.parse(read("package.json")) as { dependencies: Record<string, string> };
    const builtins = [...new Set(builtinModules.map((name) => name.replace(/^node:/, "")))]
      .filter((name) => !PURE_BUILTINS.has(name))
      .flatMap((name) => [name, `node:${name}`]);

    for (const includes of PURE_FOLDERS) {
      const denied = deniedBy(includes);
      expect(denied.length, `no import path denied at ${includes}`).toBeGreaterThan(0);
      expect(
        builtins.filter((name) => !denied.includes(name)),
        `${includes} lets through a builtin this Node knows`
      ).toEqual([]);
      for (const allowed of PURE_BUILTINS) {
        expect(denied, `${includes} denies ${allowed}`).not.toContain(allowed);
        expect(denied, `${includes} denies node:${allowed}`).not.toContain(`node:${allowed}`);
      }
      expect(
        Object.keys(pkg.dependencies).filter((name) => !denied.includes(name)),
        `${includes} lets through a dependency of package.json`
      ).toEqual([]);
    }
  });

  it("bans the filesystem and child processes in a unit test, and in nothing else", () => {
    const config = JSON.parse(read("biome.json")) as {
      overrides?: {
        includes?: string[];
        linter?: {
          rules?: { style?: { noRestrictedImports?: { options?: { paths?: unknown } } } };
        };
      }[];
    };
    const carrier = (config.overrides ?? []).find(
      (o) =>
        o.linter?.rules?.style?.noRestrictedImports?.options?.paths !== undefined &&
        !PURE_FOLDERS.some((folder) => folder === o.includes?.[0]) &&
        o.includes?.[0]?.startsWith("tests/")
    );

    expect(carrier?.includes, "no override denies fs and child_process to a unit test").toEqual([
      "tests/**/*.unit.test.ts",
    ]);
  });
});

/** What distribution's layers must not import, and the layers that try it. */
const DISTRIBUTION_LAYERS = ["domain", "ports", "application", "infrastructure"] as const;
const DISTRIBUTION_REACHES = [["framework", DISTRIBUTION_LAYERS]] as const;
const distributionReaches = (): string[] =>
  DISTRIBUTION_REACHES.flatMap(([target, layers]) =>
    layers.map((layer) => `src/contexts/distribution/${layer}/reaches-${target}.ts`)
  );
describe("the guard itself", () => {
  let planted: string;
  const readsEnvSource = "export const home = (): string | undefined => process.env.HOME;\n";

  beforeAll(() => {
    planted = mkdtempSync(join(tmpdir(), "aidd-biome-bite-"));
    cpSync(join(CLI_ROOT, "biome.json"), join(planted, "biome.json"));
    cpSync(join(CLI_ROOT, "biome-plugins"), join(planted, "biome-plugins"), { recursive: true });
    for (const dir of [
      "src/shared/domain",
      "src/presentation",
      "tests/shared/domain",
      "src/contexts/framework/domain",
      "src/contexts/framework/application",
      "src/contexts/framework/infrastructure",
      "src/contexts/tools/infrastructure",
      "src/presentation/display",
      "src/presentation/terminal",
      "src/shared/ports",
      "src/shared/infrastructure",
      "src/contexts/tools/domain",
      "src/contexts/auth/contract",
      "src/contexts/auth/domain",
      "src/contexts/auth/application",
      "src/contexts/auth/infrastructure",
      "src/contexts/auth/ports",
      "src/contexts/update/application",
      "src/contexts/update/infrastructure",
      "src/contexts/recipes/domain",
      "src/contexts/recipes/ports",
      "src/contexts/recipes/application",
      "src/contexts/recipes/infrastructure",
      "src/contexts/distribution/domain",
      "src/contexts/distribution/ports",
      "src/contexts/distribution/application",
      "src/contexts/distribution/infrastructure",
      "src/composition",
    ]) {
      mkdirSync(join(planted, dir), { recursive: true });
    }
    writeFileSync(
      join(planted, "src/shared/domain/exit.ts"),
      "export const stop = (): never => process.exit(1);\n"
    );
    writeFileSync(
      join(planted, "src/presentation/exit.ts"),
      "export const stop = (): never => process.exit(1);\n"
    );
    for (const file of [
      "src/presentation/project-root.ts",
      "src/presentation/terminal/prompter-adapter.ts",
    ]) {
      writeFileSync(join(planted, file), "export const stop = (): never => process.exit(1);\n");
    }
    writeFileSync(
      join(planted, "src/shared/domain/default.ts"),
      "const value = 1;\nexport default value;\n"
    );
    writeFileSync(
      join(planted, "tests/shared/domain/default.ts"),
      "const value = 1;\nexport default value;\n"
    );
    writeFileSync(join(planted, "src/shared/domain/clean.ts"), "export const one = 1;\n");
    writeFileSync(
      join(planted, "tests/shared/domain/reads.unit.test.ts"),
      'import { readFileSync } from "node:fs";\nexport const read = readFileSync;\n'
    );
    writeFileSync(
      join(planted, "tests/shared/domain/awaits.unit.test.ts"),
      'import { readFile } from "node:fs/promises";\nexport const read = readFile;\n'
    );
    writeFileSync(
      join(planted, "tests/shared/domain/spawns.unit.test.ts"),
      'export const load = () => import("node:child_process");\n'
    );
    writeFileSync(
      join(planted, "tests/shared/domain/reads.integration.test.ts"),
      'import { readFileSync } from "node:fs";\nexport const read = readFileSync;\n'
    );
    writeFileSync(
      join(planted, "src/shared/infrastructure/http-client.ts"),
      "export type HttpClient = number;\n"
    );
    writeFileSync(
      join(planted, "src/contexts/tools/domain/registry.ts"),
      "export type Registry = number;\n"
    );
    writeFileSync(
      join(planted, "src/contexts/auth/contract/token-provider.ts"),
      "export type TokenProvider = number;\n"
    );
    const reachesAuth = (up: string): string =>
      `import type { TokenProvider } from "${up}auth/contract/token-provider.js";\nexport type Provider = TokenProvider;\n`;
    writeFileSync(
      join(planted, "src/contexts/tools/domain/reaches-auth.ts"),
      reachesAuth("../../")
    );
    writeFileSync(
      join(planted, "src/contexts/distribution/infrastructure/reaches-auth.ts"),
      reachesAuth("../../")
    );
    writeFileSync(
      join(planted, "src/contexts/auth/domain/reaches-tools.ts"),
      'import type { Registry } from "../../tools/domain/registry.js";\nexport type Reached = Registry;\n'
    );
    writeFileSync(
      join(planted, "src/contexts/auth/contract/credential.ts"),
      "export type Credential = number;\n"
    );
    writeFileSync(
      join(planted, "src/contexts/auth/domain/credential-record.ts"),
      "export type CredentialRecord = number;\n"
    );
    writeFileSync(
      join(planted, "src/contexts/auth/ports/identity-verifier.ts"),
      "export type IdentityVerifier = number;\n"
    );
    writeFileSync(
      join(planted, "src/contexts/auth/application/log-in.ts"),
      "export type LogIn = number;\n"
    );
    writeFileSync(
      join(planted, "src/contexts/auth/infrastructure/gh-cli-adapter.ts"),
      "export type GhCliAdapter = number;\n"
    );
    const reachesAuthFolder = (up: string, folder: string, file: string, name: string): string =>
      `import type { ${name} } from "${up}auth/${folder}/${file}.js";\nexport type Reached = ${name};\n`;
    const authFolders = [
      ["domain", "credential-record", "CredentialRecord"],
      ["ports", "identity-verifier", "IdentityVerifier"],
      ["application", "log-in", "LogIn"],
      ["infrastructure", "gh-cli-adapter", "GhCliAdapter"],
      ["contract", "credential", "Credential"],
    ] as const;
    for (const [folder, file, name] of authFolders) {
      for (const [dir, up] of [
        ["src/presentation/display", "../../contexts/"],
        ["src/composition", "../contexts/"],
        ["src/contexts/distribution/infrastructure", "../../"],
        ["src/contexts/framework/application", "../../"],
      ] as const) {
        writeFileSync(
          join(planted, dir, `reaches-auth-${folder}.ts`),
          reachesAuthFolder(up, folder, file, name)
        );
      }
    }
    const imports = (specifier: string): string =>
      `import * as mod from "${specifier}";\nexport const used = mod;\n`;
    mkdirSync(join(planted, "src/contexts/auth/domain/pure"), { recursive: true });
    for (const [name, specifier] of [
      ["fs", "node:fs"],
      ["os", "node:os"],
      ["commander", "commander"],
      ["bare-fs", "fs"],
      ["path", "node:path"],
      ["crypto", "node:crypto"],
    ] as const) {
      writeFileSync(
        join(planted, `src/contexts/auth/domain/pure/imports-${name}.ts`),
        imports(specifier)
      );
    }
    writeFileSync(join(planted, "src/contexts/auth/ports/imports-fs.ts"), imports("node:fs"));
    writeFileSync(join(planted, "src/contexts/auth/contract/imports-fs.ts"), imports("node:fs"));
    writeFileSync(join(planted, "src/shared/domain/imports-fs.ts"), imports("node:fs"));
    writeFileSync(join(planted, "src/shared/domain/imports-path.ts"), imports("node:path"));
    writeFileSync(join(planted, "src/shared/ports/imports-fs.ts"), imports("node:fs"));
    writeFileSync(join(planted, "src/shared/ports/imports-path.ts"), imports("node:path"));
    writeFileSync(join(planted, "src/contexts/auth/ports/env.ts"), readsEnvSource);
    writeFileSync(join(planted, "src/contexts/auth/contract/env.ts"), readsEnvSource);
    for (const folder of ["application", "infrastructure"]) {
      writeFileSync(
        join(planted, `src/contexts/update/${folder}/spawns.ts`),
        'import { execSync } from "node:child_process";\nexport const run = execSync;\n'
      );
    }
    for (const folder of ["application", "infrastructure"]) {
      writeFileSync(join(planted, `src/contexts/recipes/${folder}/reads.ts`), imports("node:fs"));
    }
    writeFileSync(join(planted, "src/contexts/recipes/domain/imports-fs.ts"), imports("node:fs"));
    writeFileSync(join(planted, "src/contexts/recipes/ports/imports-fs.ts"), imports("node:fs"));
    writeFileSync(
      join(planted, "src/contexts/recipes/domain/reaches-framework.ts"),
      'import type { Registry } from "../../framework/domain/registry.js";\nexport type Reached = Registry;\n'
    );
    writeFileSync(
      join(planted, "src/contexts/framework/application/reaches-recipes.ts"),
      'import type { Run } from "../../recipes/application/validate-recipes.js";\nexport type Reached = Run;\n'
    );
    for (const folder of ["domain", "application"]) {
      writeFileSync(
        join(planted, `src/presentation/display/reaches-recipes-${folder}.ts`),
        `import type { Reached } from "../../contexts/recipes/${folder}/x.js";\nexport type Used = Reached;\n`
      );
    }
    for (const file of distributionReaches()) {
      const target = "framework";
      writeFileSync(
        join(planted, file),
        `import type { X } from "../../../${target}/x.js";\nexport type Z = X;\n`
      );
    }
    writeFileSync(join(planted, "src/composition/auth.ts"), "export type AuthDeps = number;\n");
    const reachesComposition = (up: string): string =>
      `import type { AuthDeps } from "${up}composition/auth.js";\nexport type Wired = AuthDeps;\n`;
    for (const [file, up] of [
      ["src/contexts/tools/domain/reaches-composition.ts", "../../../"],
      ["src/shared/domain/reaches-composition.ts", "../../"],
      ["src/shared/infrastructure/reaches-composition.ts", "../../"],
      ["src/presentation/display/reaches-composition.ts", "../../"],
      ["src/composition/reaches-composition.ts", "../"],
    ] as const) {
      writeFileSync(join(planted, file), reachesComposition(up));
    }
    const reachesSharedInfrastructure = (up: string): string =>
      `import type { HttpClient } from "${up}shared/infrastructure/http-client.js";\nexport type Client = HttpClient;\n`;
    for (const [file, up] of [
      ["src/contexts/tools/infrastructure/reaches-shared.ts", "../../../"],
      ["src/presentation/display/reaches-shared.ts", "../../"],
      ["src/composition/reaches-shared.ts", "../"],
    ] as const) {
      writeFileSync(join(planted, file), reachesSharedInfrastructure(up));
    }
    writeFileSync(
      join(planted, "src/shared/ports/reaches-context.ts"),
      'import type { Registry } from "../../contexts/tools/domain/registry.js";\nexport type Reached = Registry;\n'
    );
    writeFileSync(
      join(planted, "src/shared/infrastructure/reaches-context.ts"),
      'import type { Registry } from "../../contexts/tools/domain/registry.js";\nexport type Reached = Registry;\n'
    );
    writeFileSync(
      join(planted, "src/shared/domain/reaches-context.ts"),
      'import type { Registry } from "../../contexts/tools/domain/registry.js";\nexport type Reached = Registry;\n'
    );
    writeFileSync(
      join(planted, "src/shared/ports/env.ts"),
      "export const home = (): string | undefined => process.env.HOME;\n"
    );
    writeFileSync(
      join(planted, "src/shared/infrastructure/exit.ts"),
      "export const stop = (): never => process.exit(1);\n"
    );
    for (const file of [
      "src/contexts/framework/domain/env.ts",
      "src/contexts/framework/application/env.ts",
      "src/contexts/framework/infrastructure/env.ts",
    ]) {
      writeFileSync(join(planted, file), readsEnvSource);
    }
  });

  afterAll(() => {
    rmSync(planted, { recursive: true, force: true });
  });

  it("flags process.exit under shared/, contexts/ and the two moved presentation files, and leaves the command edge alone", () => {
    const findings = biomeFindings(planted);
    expect(findings, findings.join(", ")).toContain("src/shared/domain/exit.ts:plugin");
    expect(
      findings.filter((f) => f.startsWith("src/presentation/") && f.endsWith(":plugin")).sort()
    ).toEqual([
      "src/presentation/project-root.ts:plugin",
      "src/presentation/terminal/prompter-adapter.ts:plugin",
    ]);
  });

  it("flags the process global in a context's domain and application, and not in its infrastructure", () => {
    const findings = biomeFindings(planted);

    expect(findings, findings.join(", ")).toContain(
      "src/contexts/framework/domain/env.ts:lint/style/noRestrictedGlobals"
    );
    expect(findings, findings.join(", ")).toContain(
      "src/contexts/framework/application/env.ts:lint/style/noRestrictedGlobals"
    );
    expect(findings.filter((f) => f.startsWith("src/contexts/framework/infrastructure/"))).toEqual(
      []
    );
  });

  it("flags shared/ports and shared/infrastructure reaching a context, and shared/domain reaching a context", () => {
    const findings = biomeFindings(planted);
    const rule = "lint/style/noRestrictedImports";

    for (const file of [
      "src/shared/ports/reaches-context.ts",
      "src/shared/infrastructure/reaches-context.ts",
      "src/shared/domain/reaches-context.ts",
    ]) {
      expect(findings, findings.join(", ")).toContain(`${file}:${rule}`);
    }
  });

  it("flags a context's infrastructure and presentation reaching shared/infrastructure, never the composition root", () => {
    const findings = biomeFindings(planted);
    const rule = "lint/style/noRestrictedImports";

    for (const file of [
      "src/contexts/tools/infrastructure/reaches-shared.ts",
      "src/presentation/display/reaches-shared.ts",
    ]) {
      expect(findings, findings.join(", ")).toContain(`${file}:${rule}`);
    }
    expect(findings).not.toContain(`src/composition/reaches-shared.ts:${rule}`);
  });

  it("flags a context nothing admits reaching auth, and auth reaching a context, and not distribution reaching auth", () => {
    const findings = biomeFindings(planted);
    const rule = "lint/style/noRestrictedImports";

    expect(findings, findings.join(", ")).toContain(
      `src/contexts/tools/domain/reaches-auth.ts:${rule}`
    );
    expect(findings, findings.join(", ")).toContain(
      `src/contexts/auth/domain/reaches-tools.ts:${rule}`
    );
    expect(findings).not.toContain(
      `src/contexts/distribution/infrastructure/reaches-auth.ts:${rule}`
    );
  });

  it("flags presentation and an admitted context reaching auth's domain, ports or infrastructure, and clears the contract and the commands", () => {
    const findings = biomeFindings(planted);
    const rule = "lint/style/noRestrictedImports";
    const importers = [
      "src/presentation/display",
      "src/contexts/distribution/infrastructure",
      "src/contexts/framework/application",
    ];

    for (const dir of importers) {
      for (const folder of ["domain", "ports", "infrastructure"]) {
        expect(findings, findings.join(", ")).toContain(`${dir}/reaches-auth-${folder}.ts:${rule}`);
      }
      for (const folder of ["contract", "application"]) {
        expect(findings).not.toContain(`${dir}/reaches-auth-${folder}.ts:${rule}`);
      }
    }
    for (const folder of ["domain", "ports", "application", "infrastructure", "contract"]) {
      expect(findings, "the composition root imports every folder of auth").not.toContain(
        `src/composition/reaches-auth-${folder}.ts:${rule}`
      );
    }
  });

  it("flags the update context's application running a process, and not its infrastructure", () => {
    const findings = biomeFindings(planted);
    const rule = "lint/style/noRestrictedImports";

    expect(findings, findings.join(", ")).toContain(
      `src/contexts/update/application/spawns.ts:${rule}`
    );
    expect(findings).not.toContain(`src/contexts/update/infrastructure/spawns.ts:${rule}`);
  });

  it("flags the recipes context's application reading the disk, and not its infrastructure", () => {
    const findings = biomeFindings(planted);
    const rule = "lint/style/noRestrictedImports";

    expect(findings, findings.join(", ")).toContain(
      `src/contexts/recipes/application/reads.ts:${rule}`
    );
    expect(findings).not.toContain(`src/contexts/recipes/infrastructure/reads.ts:${rule}`);
  });

  it("flags recipes reaching framework, framework reaching recipes, and presentation reaching recipes beyond its commands", () => {
    const findings = biomeFindings(planted);
    const rule = "lint/style/noRestrictedImports";

    for (const file of [
      "src/contexts/recipes/domain/reaches-framework.ts",
      "src/contexts/framework/application/reaches-recipes.ts",
      "src/presentation/display/reaches-recipes-domain.ts",
    ]) {
      expect(findings, findings.join(", ")).toContain(`${file}:${rule}`);
    }
    expect(findings).not.toContain(
      `src/presentation/display/reaches-recipes-application.ts:${rule}`
    );
  });

  it("flags every distribution layer reaching framework", () => {
    const findings = biomeFindings(planted);
    for (const file of distributionReaches()) {
      expect(findings, findings.join(", ")).toContain(`${file}:lint/style/noRestrictedImports`);
    }
  });

  it("flags a context, shared and presentation reaching the composition, and not the composition root", () => {
    const findings = biomeFindings(planted);
    const rule = "lint/style/noRestrictedImports";

    for (const file of [
      "src/contexts/tools/domain/reaches-composition.ts",
      "src/shared/domain/reaches-composition.ts",
      "src/shared/infrastructure/reaches-composition.ts",
      "src/presentation/display/reaches-composition.ts",
    ]) {
      expect(findings, findings.join(", ")).toContain(`${file}:${rule}`);
    }
    expect(findings).not.toContain(`src/composition/reaches-composition.ts:${rule}`);
  });

  it("flags a package or a Node builtin in a pure folder, and clears path and crypto", () => {
    const findings = biomeFindings(planted);
    const rule = "lint/style/noRestrictedImports";

    for (const file of [
      "src/contexts/auth/domain/pure/imports-fs.ts",
      "src/contexts/auth/domain/pure/imports-os.ts",
      "src/contexts/auth/domain/pure/imports-commander.ts",
      "src/contexts/auth/domain/pure/imports-bare-fs.ts",
      "src/contexts/auth/ports/imports-fs.ts",
      "src/contexts/auth/contract/imports-fs.ts",
      "src/contexts/recipes/domain/imports-fs.ts",
      "src/contexts/recipes/ports/imports-fs.ts",
      "src/shared/domain/imports-fs.ts",
      "src/shared/ports/imports-fs.ts",
    ]) {
      expect(findings, findings.join(", ")).toContain(`${file}:${rule}`);
    }
    for (const file of [
      "src/contexts/auth/domain/pure/imports-path.ts",
      "src/contexts/auth/domain/pure/imports-crypto.ts",
      "src/shared/domain/imports-path.ts",
      "src/shared/ports/imports-path.ts",
    ]) {
      expect(findings).not.toContain(`${file}:${rule}`);
    }
  });

  it("flags the process global in a context's ports and contract", () => {
    const findings = biomeFindings(planted);

    for (const file of ["src/contexts/auth/ports/env.ts", "src/contexts/auth/contract/env.ts"]) {
      expect(findings, findings.join(", ")).toContain(`${file}:lint/style/noRestrictedGlobals`);
    }
  });

  it("flags the process global in shared/ports and process.exit in shared/infrastructure", () => {
    const findings = biomeFindings(planted);

    expect(findings, findings.join(", ")).toContain(
      "src/shared/ports/env.ts:lint/style/noRestrictedGlobals"
    );
    expect(findings, findings.join(", ")).toContain("src/shared/infrastructure/exit.ts:plugin");
  });

  it("reads a file the GitHub reporter escaped, as on Windows", () => {
    expect(reportedFile("C%3A\\tmp\\a%2Cb%25.ts")).toBe("C:\\tmp\\a,b%.ts");
  });

  it("fails when biome does not run, rather than reading as no findings", () => {
    expect(() => biomeFindings(planted, join(planted, "missing-biome"))).toThrow(
      /biome did not run/
    );
  });

  it("flags the filesystem and child processes in a unit test, and not in an integration test", () => {
    const findings = biomeFindings(planted);
    const rule = "lint/style/noRestrictedImports";

    expect(findings, findings.join(", ")).toContain(
      `tests/shared/domain/reads.unit.test.ts:${rule}`
    );
    expect(findings, findings.join(", ")).toContain(
      `tests/shared/domain/awaits.unit.test.ts:${rule}`
    );
    expect(findings, findings.join(", ")).toContain(
      `tests/shared/domain/spawns.unit.test.ts:${rule}`
    );
    expect(findings).not.toContain(`tests/shared/domain/reads.integration.test.ts:${rule}`);
  });

  it("flags a default export under src/ and tests/ alike, and a clean module not at all", () => {
    const findings = biomeFindings(planted);
    expect(findings, findings.join(", ")).toContain(
      "src/shared/domain/default.ts:lint/style/noDefaultExport"
    );
    expect(findings, findings.join(", ")).toContain(
      "tests/shared/domain/default.ts:lint/style/noDefaultExport"
    );
    expect(findings.filter((f) => f.startsWith("src/shared/domain/clean.ts"))).toEqual([]);
  });
});
