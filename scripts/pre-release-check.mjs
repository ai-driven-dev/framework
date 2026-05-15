/**
 * Pre-release gate — run before publishing v4.1.0 stable.
 *
 * Usage:
 *   node scripts/pre-release-check.mjs
 *
 * Exits 0 only when all checks pass. Run after `pnpm build`.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(import.meta.url), "../..");

let failed = false;

function pass(label) {
  console.log(`  PASS  ${label}`);
}

function fail(label, detail = "") {
  console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  failed = true;
}

function run(cmd, label) {
  try {
    execSync(cmd, { cwd: root, stdio: "pipe" });
    pass(label);
  } catch (err) {
    fail(label, err.stdout?.toString().trim() || err.stderr?.toString().trim() || "non-zero exit");
  }
}

console.log("\n=== Pre-release check — @ai-driven-dev/cli ===\n");

// 1. Version sanity
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const version = pkg.version;
if (!version) {
  fail("version present in package.json");
} else if (version.includes("beta") || version.includes("alpha") || version.includes("rc")) {
  fail("version is stable (no pre-release tag)", `current: ${version}`);
} else {
  pass(`version is stable: ${version}`);
}

// 2. CHANGELOG has a [<version>] or [4.1.0] section
const changelog = existsSync(resolve(root, "CHANGELOG.md"))
  ? readFileSync(resolve(root, "CHANGELOG.md"), "utf8")
  : "";
if (changelog.includes(`## [${version}]`) || changelog.includes("## [4.1.0]")) {
  pass("CHANGELOG contains stable section");
} else {
  fail("CHANGELOG missing stable section", `expected ## [${version}]`);
}

// 3. Bundle exists and is within budget
const bundlePath = resolve(root, "dist/cli.js");
if (!existsSync(bundlePath)) {
  fail("dist/cli.js exists (run pnpm build first)");
} else {
  const budgetKB = pkg.bundleBudgetKB ?? 500;
  const sizeBytes = statSync(bundlePath).size;
  const sizeKB = (sizeBytes / 1024).toFixed(1);
  if (sizeBytes > budgetKB * 1024) {
    fail("bundle within budget", `${sizeKB} KB > ${budgetKB} KB`);
  } else {
    pass(`bundle within budget: ${sizeKB} KB / ${budgetKB} KB`);
  }
}

// 4. TypeScript clean
run("pnpm typecheck", "typecheck clean");

// 5. Biome clean
run("./node_modules/.bin/biome check .", "biome clean");

// 6. Tests green
run("pnpm test:unit", "unit tests green");
run("pnpm test:integration", "integration tests green");

// 7. Knip clean
run("pnpm knip:production", "knip:production clean");

// Summary
console.log(
  `\n${failed ? "FAIL — fix above errors before publishing." : "OK — all pre-release checks passed."}\n`
);
process.exit(failed ? 1 : 0);
