#!/usr/bin/env node
/**
 * Writes the context boundary groups of `biome.json` from the edge table
 * (`tests/architecture/allowed-edges.ts`): `pnpm biome:boundaries`.
 *
 * Biome replaces a rule's whole `options` with the LAST override matching a file, so each file
 * carries exactly one `noRestrictedImports` override per context layer. What the table decides
 * is which groups that override lists, never the message or the `paths` it already carries: a
 * pattern is regenerated in place, found by what it holds, so the rationale written beside it
 * stays. A context layer with no override, or an edge with no interior pattern to carry its
 * message, is refused: write that rationale once by hand, then regenerate.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CLI_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Every context has these three. */
const LAYERS = ["domain", "application", "infrastructure"];
/** A context also has these wherever the folder exists. */
const OPTIONAL_LAYERS = ["ports", "contract"];
const INTERIOR_FOLDERS = ["domain", "ports", "infrastructure"];
/** `tools` keeps its `application/` to the composition root too: what an outside caller asks of
 * a tool is in `contract/`, and the one application file builds the catalog the root hands out. */
const APPLICATION_CLOSED = new Set(["tools"]);
const COMPOSITION = ["**/composition/**"];
/** What a file at each layer must not import, whatever its context. */
const LAYER_GROUPS = {
  domain: ["**/application/**", "**/infrastructure/**", "**/presentation/**"],
  ports: ["**/application/**", "**/infrastructure/**", "**/presentation/**"],
  contract: [
    "**/domain/**",
    "**/application/**",
    "**/infrastructure/**",
    "**/ports/**",
    "**/presentation/**",
    "!**/shared/domain/**",
  ],
  application: ["**/infrastructure/**"],
  infrastructure: ["**/shared/infrastructure/**"],
};
const CONTEXT_GROUP = /^\*\*\/([^/]+)\/\*\*$/;
const INTERIOR_GROUP = /^\*\*\/([^/]+)\/(?:domain|ports|infrastructure|application)\/\*\*$/;

/** The folders of a held context another context may not reach. */
export function interiorGroupsOf(context, contextsDir) {
  const folders = APPLICATION_CLOSED.has(context)
    ? [...INTERIOR_FOLDERS, "application"]
    : INTERIOR_FOLDERS;
  return folders
    .filter((folder) => existsSync(join(contextsDir, context, folder)))
    .map((folder) => `**/${context}/${folder}/**`);
}

/** The edge table and the source tree, in the shape `boundaryOverrides` reads. */
export function boundaryInputs(srcDir, { allowed, heldByBiome }) {
  const contextsDir = join(srcDir, "contexts");
  const contexts = readdirSync(contextsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  return {
    contexts,
    allowed,
    heldByBiome,
    layersOf: (context) => [
      ...LAYERS,
      ...OPTIONAL_LAYERS.filter((layer) => existsSync(join(contextsDir, context, layer))),
    ],
    interiorGroupsOf: (context) => interiorGroupsOf(context, contextsDir),
  };
}

export function overrideIncludes(context, layer) {
  return `src/contexts/${context}/${layer}/**/*.ts`;
}

export function restrictedImportOptions(override) {
  return override.linter?.rules?.style?.noRestrictedImports?.options;
}

function roleOf(groups, known) {
  if (groups.length === 1 && groups[0] === COMPOSITION[0]) return "composition";
  if (groups.length > 0 && groups.every((group) => known.has(INTERIOR_GROUP.exec(group)?.[1])))
    return "interior";
  if (groups.some((group) => known.has(CONTEXT_GROUP.exec(group)?.[1]))) return "edge";
  if (groups.every((group) => group.endsWith(".js"))) return "extra";
  return "layer";
}

function regeneratePatterns(patterns, { context, layer, input, known }) {
  const where = overrideIncludes(context, layer);
  const layerGroups = LAYER_GROUPS[layer];
  const edgeGroups = input.contexts
    .filter((other) => other !== context && !input.allowed.has(`${context}->${other}`))
    .map((other) => `**/${other}/**`);
  if (!layerGroups.includes("**/presentation/**")) edgeGroups.push("**/presentation/**");
  const interiorGroups = input.heldByBiome
    .filter((held) => held !== context && input.allowed.has(`${context}->${held}`))
    .flatMap(input.interiorGroupsOf);

  const seen = { layer: 0, edge: 0, composition: 0, interior: 0 };
  const out = [];
  for (const pattern of patterns) {
    const role = roleOf(pattern.group ?? [], known);
    if (role === "extra") {
      out.push(pattern);
      continue;
    }
    seen[role] += 1;
    if (role === "composition") out.push(pattern);
    else if (role === "layer") out.push({ ...pattern, group: layerGroups });
    else if (role === "edge") {
      // One pattern per file carries every edge, so a second one folds into the first. A `.js`
      // group inside it is a file, not an edge: the table does not own it.
      if (seen.edge > 1) continue;
      const files = (pattern.group ?? []).filter((group) => group.endsWith(".js"));
      out.push({ ...pattern, group: [...edgeGroups, ...files] });
    } else if (interiorGroups.length > 0) out.push({ ...pattern, group: interiorGroups });
  }
  for (const role of ["layer", "composition"]) {
    if (seen[role] !== 1) {
      throw new Error(`${where}: ${seen[role]} ${role} patterns found, one expected`);
    }
  }
  if (seen.edge === 0) throw new Error(`${where}: no edge pattern found to carry the edges`);
  if (seen.interior > 1 || (seen.interior === 0 && interiorGroups.length > 0)) {
    throw new Error(
      `${where}: ${seen.interior} interior patterns found, expected one carrying the message of ${interiorGroups.join(", ")}`
    );
  }
  return out;
}

/** The config with every context layer's `noRestrictedImports` groups recomputed from the table. */
export function boundaryOverrides(config, input) {
  const known = new Set(input.contexts);
  const overrides = structuredClone(config.overrides ?? []);
  for (const context of input.contexts) {
    for (const layer of input.layersOf(context)) {
      const glob = overrideIncludes(context, layer);
      const override = overrides.find(
        (candidate) =>
          candidate.includes?.includes(glob) && restrictedImportOptions(candidate)?.patterns
      );
      if (override === undefined) throw new Error(`no override at ${glob}`);
      const options = restrictedImportOptions(override);
      options.patterns = regeneratePatterns(options.patterns, { context, layer, input, known });
    }
  }
  return { ...config, overrides };
}

async function main() {
  const { ALLOWED, HELD_BY_BIOME } = await import("../tests/architecture/allowed-edges.ts");
  const file = join(CLI_ROOT, "biome.json");
  const config = JSON.parse(readFileSync(file, "utf8"));
  const input = boundaryInputs(join(CLI_ROOT, "src"), {
    allowed: ALLOWED,
    heldByBiome: HELD_BY_BIOME,
  });
  writeFileSync(file, `${JSON.stringify(boundaryOverrides(config, input), null, 2)}\n`);
  const biome = join(CLI_ROOT, "node_modules", "@biomejs", "biome", "bin", "biome");
  const run = spawnSync(process.execPath, [biome, "format", "--write", file], {
    cwd: CLI_ROOT,
    stdio: "inherit",
  });
  process.exit(run.status ?? 1);
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
