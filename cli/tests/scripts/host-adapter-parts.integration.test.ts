import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "tsup";
import { describe, expect, it } from "vitest";
import { asPlainObject } from "../../src/shared/domain/reading/plain-object.js";

const RUNTIME = resolve(import.meta.dirname, "..", "..", "assets", "hooks-runtime");
// Required, not imported: the test run loads a `.cjs` file as its text.
const { joinedHostAdapters } = createRequire(import.meta.url)(
  "../../scripts/host-adapter-parts.cjs"
);

/** Every committed adapter, by file name, as the bundler's join of its parts spells it. */
async function joinedAdapters(adapters: readonly string[]): Promise<Record<string, unknown>> {
  const dir = mkdtempSync(join(tmpdir(), "aidd-host-adapters-"));
  try {
    const entry = join(dir, "entry.js");
    writeFileSync(
      entry,
      adapters
        .map(
          (adapter, index) =>
            `export { default as a${index} } from ${JSON.stringify(join(RUNTIME, adapter))};`
        )
        .join("\n")
    );
    await build({
      entry: { adapters: entry },
      format: ["esm"],
      outDir: dir,
      config: false,
      silent: true,
      esbuildPlugins: [joinedHostAdapters],
    });
    const built = asPlainObject(await import(pathToFileURL(join(dir, "adapters.js")).href));
    return Object.fromEntries(adapters.map((adapter, index) => [adapter, built?.[`a${index}`]]));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("the bundler joining a host adapter from its parts", () => {
  it("spells every committed adapter byte for byte", async () => {
    const adapters = readdirSync(RUNTIME).filter((name) => /^host-.+\.cjs$/.test(name));
    const committed = Object.fromEntries(
      adapters.map((adapter) => [adapter, readFileSync(join(RUNTIME, adapter), "utf8")])
    );

    expect(adapters).not.toEqual([]);
    expect(await joinedAdapters(adapters)).toEqual(committed);
  });
});
