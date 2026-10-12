/**
 * Three rules live in biome rather than here: `process.exit` below the command edge through the
 * GritQL plugin, `export default` under src/ and tests/, and the `process` global in a context's
 * domain and application. A rule biome silently stops applying is invisible, so each is planted.
 */
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
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

describe("biome carries the exit and default-export rules", () => {
  it("scopes the process.exit plugin to the layers that throw, and to nothing else", () => {
    const config = JSON.parse(read("biome.json")) as {
      overrides?: { includes?: string[]; plugins?: string[] }[];
    };
    const carrier = (config.overrides ?? []).find((o) => o.plugins?.includes(`./${PLUGIN}`));
    expect(carrier?.includes, `no override applies ${PLUGIN}`).toEqual([
      "src/kernel/**",
      "src/contexts/**",
      "src/runtime/**",
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
    ).toEqual(["src/contexts/*/domain/**/*.ts", "src/contexts/*/application/**/*.ts"]);
  });
});

describe("the guard itself", () => {
  let planted: string;

  beforeAll(() => {
    planted = mkdtempSync(join(tmpdir(), "aidd-biome-bite-"));
    cpSync(join(CLI_ROOT, "biome.json"), join(planted, "biome.json"));
    cpSync(join(CLI_ROOT, "biome-plugins"), join(planted, "biome-plugins"), { recursive: true });
    for (const dir of [
      "src/kernel",
      "src/presentation",
      "tests/kernel",
      "src/contexts/framework/domain",
      "src/contexts/framework/application",
      "src/contexts/framework/infrastructure",
    ]) {
      mkdirSync(join(planted, dir), { recursive: true });
    }
    writeFileSync(
      join(planted, "src/kernel/exit.ts"),
      "export const stop = (): never => process.exit(1);\n"
    );
    writeFileSync(
      join(planted, "src/presentation/exit.ts"),
      "export const stop = (): never => process.exit(1);\n"
    );
    writeFileSync(
      join(planted, "src/kernel/default.ts"),
      "const value = 1;\nexport default value;\n"
    );
    writeFileSync(
      join(planted, "tests/kernel/default.ts"),
      "const value = 1;\nexport default value;\n"
    );
    writeFileSync(join(planted, "src/kernel/clean.ts"), "export const one = 1;\n");
    const readsEnv = "export const home = (): string | undefined => process.env.HOME;\n";
    for (const file of [
      "src/contexts/framework/domain/env.ts",
      "src/contexts/framework/application/env.ts",
      "src/contexts/framework/infrastructure/env.ts",
    ]) {
      writeFileSync(join(planted, file), readsEnv);
    }
  });

  afterAll(() => {
    rmSync(planted, { recursive: true, force: true });
  });

  it("flags process.exit under kernel/, contexts/ and runtime/, and leaves the command edge alone", () => {
    const findings = biomeFindings(planted);
    expect(findings, findings.join(", ")).toContain("src/kernel/exit.ts:plugin");
    expect(findings.filter((f) => f.startsWith("src/presentation/"))).toEqual([]);
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

  it("reads a file the GitHub reporter escaped, as on Windows", () => {
    expect(reportedFile("C%3A\\tmp\\a%2Cb%25.ts")).toBe("C:\\tmp\\a,b%.ts");
  });

  it("fails when biome does not run, rather than reading as no findings", () => {
    expect(() => biomeFindings(planted, join(planted, "missing-biome"))).toThrow(
      /biome did not run/
    );
  });

  it("flags a default export under src/ and tests/ alike, and a clean module not at all", () => {
    const findings = biomeFindings(planted);
    expect(findings, findings.join(", ")).toContain(
      "src/kernel/default.ts:lint/style/noDefaultExport"
    );
    expect(findings, findings.join(", ")).toContain(
      "tests/kernel/default.ts:lint/style/noDefaultExport"
    );
    expect(findings.filter((f) => f.startsWith("src/kernel/clean.ts"))).toEqual([]);
  });
});
