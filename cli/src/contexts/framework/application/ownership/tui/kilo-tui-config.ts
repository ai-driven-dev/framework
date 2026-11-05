import { join } from "node:path";
import { applyEdits, createScanner, modify, parse, SyntaxKind } from "jsonc-parser";
import type { FileReader } from "../../../../../kernel/ports/file-reader.js";
import type { KiloTuiProvenance } from "../../../domain/plugins/installed-plugin.js";
import { assertProjectPathWithinRoot } from "../project-path-boundary.js";

export interface KiloTuiPlan {
  readonly path: string;
  readonly content: string;
  readonly provenance: KiloTuiProvenance;
}

const entry = "./hooks/aidd-maintenance/kilo-tui.js" as const;

function comments(source: string): string[] {
  const scanner = createScanner(source);
  const result: string[] = [];
  for (let token = scanner.scan(); token !== SyntaxKind.EOF; token = scanner.scan()) {
    if (token === SyntaxKind.LineCommentTrivia || token === SyntaxKind.BlockCommentTrivia)
      result.push(scanner.getTokenValue());
  }
  return result;
}

function edit(source: string, index: number, value: string | undefined): string {
  const updated = applyEdits(
    source,
    modify(source, ["plugin", index], value, {
      isArrayInsertion: value !== undefined,
      formattingOptions: { insertSpaces: true, tabSize: 2, eol: "\n" },
    })
  );
  if (JSON.stringify(comments(source)) !== JSON.stringify(comments(updated)))
    throw new Error("Kilo TUI config: refusing an edit that would change user comments.");
  return updated;
}

async function readConfig(
  fs: FileReader,
  dir: string,
  boundary: string,
  previous?: KiloTuiProvenance
) {
  await assertProjectPathWithinRoot(fs, boundary, join(dir, "tui.json"));
  await assertProjectPathWithinRoot(fs, boundary, join(dir, "tui.jsonc"));
  const json = await fs.fileExists(join(dir, "tui.json"));
  const jsonc = await fs.fileExists(join(dir, "tui.jsonc"));
  if (json && jsonc) throw new Error("Kilo TUI: both tui.json and tui.jsonc exist.");
  const config = json ? "tui.json" : jsonc ? "tui.jsonc" : (previous?.config ?? "tui.jsonc");
  if (previous !== undefined && previous.config !== config)
    throw new Error("Kilo TUI: the tracked configuration changed; refusing to modify it.");
  const path = join(dir, config);
  const source = json || jsonc ? await fs.readFile(path) : "{}\n";
  const errors: { error: number; offset: number; length: number }[] = [];
  const value: unknown = parse(source, errors, { allowTrailingComma: true });
  if (errors.length || value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("Kilo TUI: invalid configuration; refusing to modify it.");
  const plugins = (value as Record<string, unknown>).plugin;
  if (
    plugins !== undefined &&
    (!Array.isArray(plugins) || plugins.some((p) => typeof p !== "string"))
  )
    throw new Error("Kilo TUI: plugin must be an array of strings.");
  return { path, source, plugins: (plugins ?? []) as string[], config };
}

/** Plans without writing, so collision checks precede all installation mutations. */
export async function planKiloTuiInstall(
  fs: FileReader,
  dir: string,
  boundary: string,
  previous?: KiloTuiProvenance
): Promise<KiloTuiPlan> {
  if (previous !== undefined && previous.entry !== entry)
    throw new Error("Kilo TUI: invalid recorded entry.");
  const { path, source, plugins, config } = await readConfig(fs, dir, boundary, previous);
  const count = plugins.filter((p) => p === entry).length;
  if (count > 1 || (count === 1 && previous === undefined))
    throw new Error("Kilo TUI: maintenance entry already exists without ownership.");
  if (count === 0 && previous !== undefined)
    throw new Error("Kilo TUI: tracked entry was removed; refusing to restore it.");
  const content = count === 1 ? source : edit(source, plugins.length, entry);
  return { path, content, provenance: { config, entry } };
}

/** Refuses changed or duplicate entries, and removes only the tracked entry. */
export async function planKiloTuiRemoval(
  fs: FileReader,
  dir: string,
  boundary: string,
  provenance: KiloTuiProvenance
): Promise<KiloTuiPlan> {
  if (provenance.entry !== entry) throw new Error("Kilo TUI: invalid recorded entry.");
  const { path, source, plugins } = await readConfig(fs, dir, boundary, provenance);
  const index = plugins.indexOf(entry);
  if (index === -1 || plugins.lastIndexOf(entry) !== index)
    throw new Error("Kilo TUI: tracked entry changed; refusing removal.");
  return { path, content: edit(source, index, undefined), provenance };
}
