/** The files planted to watch each Grit plugin of `biome-plugins/` bite, or spare what it allows. */
import type { Plant } from "./biome-plants.js";

const githubUrl = 'export const url = "https://api.github.com/repos/a/b/releases";\n';
// Built in two parts so the plant source holds a real placeholder without tripping the string lint.
const githubTemplate = `export const url = \`https://api.github.com/repos/$${"{"}a}/releases\`;\n`;
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
  // A catch that hands back a neutral value without rethrowing turns a failure into an absence.
  [
    "src/shared/domain/returns-null.ts",
    "export function g() { try { f(); } catch (e) { g(e); return null; } }",
    "plugin",
    1,
  ],
  [
    "src/shared/domain/returns-list.ts",
    "export function g() { try { f(); } catch { return []; } }",
    "plugin",
    1,
  ],
  [
    "src/shared/domain/returns-object.ts",
    "export function g() { try { f(); } catch { return {}; } }",
    "plugin",
    1,
  ],
  [
    "src/shared/domain/returns-text.ts",
    'export function g() { try { f(); } catch { return ""; } }',
    "plugin",
    1,
  ],
  [
    "src/shared/domain/returns-flag.ts",
    "export function g() { try { f(); } catch { return false; } }",
    "plugin",
    1,
  ],
  [
    "src/shared/domain/returns-nothing.ts",
    "export function g() { try { f(); } catch { return; } }",
    "plugin",
    1,
  ],
  [
    "src/shared/domain/returns-undefined.ts",
    "export function g() { try { f(); } catch { return undefined; } }",
    "plugin",
    1,
  ],
  [
    "src/shared/domain/assigns-null.ts",
    "export function g() { let v; try { f(); } catch { v = null; } }",
    "plugin",
    1,
  ],
  [
    "src/shared/domain/promise-undefined.ts",
    "export const v = f().catch(() => undefined);",
    "plugin",
    1,
  ],
  ["src/shared/domain/promise-list.ts", "export const v = f().catch(() => []);", "plugin", 1],
  // It is spared once the error's identity is checked and the rest rethrown, or kept in the result.
  [
    "src/shared/domain/checks-code.ts",
    'export function g() { try { f(); } catch (e) { if (e.code === "ENOENT") return null; throw e; } }',
    "plugin",
    0,
  ],
  [
    "src/shared/domain/rethrows-the-rest.ts",
    'export function g() { try { f(); } catch (e) { if (e.code !== "ENOENT") throw e; return null; } }',
    "plugin",
    0,
  ],
  [
    "src/shared/domain/rethrows-by-helper.ts",
    "export function g() { try { f(); } catch (e) { rethrowUnlessMissing(e); return {}; } }",
    "plugin",
    0,
  ],
  [
    "src/shared/domain/keeps-the-error.ts",
    "export function g() { try { f(); } catch (e) { return { ok: false, error: e }; } }",
    "plugin",
    0,
  ],
  [
    "src/shared/domain/promise-keeps-the-error.ts",
    "export const v = f().catch((e) => ({ ok: false, error: e }));",
    "plugin",
    0,
  ],
  [
    "src/shared/domain/checks-then-types.ts",
    'export function g() { try { f(); } catch (e) { if (isAbsent(e)) return null; return "unreadable"; } }',
    "plugin",
    0,
  ],
  [
    "src/shared/domain/total-predicate.ts",
    "export function g() {\n// biome-ignore lint/plugin: why\ntry { f(); } catch { return false; }\n}",
    "plugin",
    0,
  ],
  // A GitHub API URL is written by the GitHub adapter only.
  ["src/contexts/update/infrastructure/builds-github-url.ts", githubUrl, "plugin", 1],
  ["src/contexts/update/infrastructure/builds-github-template.ts", githubTemplate, "plugin", 1],
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
  // The exit status is the exit's alone: no source file assigns process.exitCode, a string naming it stays.
  ["src/presentation/controllers/sets-status.ts", "process.exitCode = 1;\n", "plugin", 1],
  ["src/orchestration/sets-status.ts", "process.exitCode = 1;\n", "plugin", 1],
  ["src/composition/sets-status.ts", "process.exitCode = 1;\n", "plugin", 1],
  [
    "src/presentation/controllers/reads-status.ts",
    "export const c = process.exitCode;\n",
    "plugin",
    0,
  ],
  [
    "src/presentation/controllers/names-status.ts",
    'export const s = "process.exitCode=1";\n',
    "plugin",
    0,
  ],
];
