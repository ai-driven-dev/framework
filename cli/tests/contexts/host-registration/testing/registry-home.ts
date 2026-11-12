import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach } from "vitest";
import { wireHostRegistration } from "../../../../src/composition/host-registration.js";
import type { AiToolId } from "../../../../src/kernel/tool.js";
import { catalogOf } from "../../tools/testing/catalog-of.js";
import { scratchDirectory } from "./scratch-directory.js";

/**
 * Fixtures carry the recorded shape only: a real machine's file holds hashed experiment
 * keys, absolute project paths and somebody's marketplaces, none of it publishable.
 */
export const PROJECT = "/repo/mine";

/** Registers a fresh home per test; `write` fills it, `readerFor` reads it through the wiring. */
export function registryHome() {
  let scratch: Awaited<ReturnType<typeof scratchDirectory>>;

  beforeEach(async () => {
    scratch = await scratchDirectory();
  });

  afterEach(async () => {
    await scratch.dispose();
  });

  return {
    home: (): string => scratch.dir,
    async write(relative: string, content: string): Promise<void> {
      const path = join(scratch.dir, relative);
      await mkdir(join(path, ".."), { recursive: true });
      await writeFile(path, content, "utf8");
    },
    readerFor(tool: AiToolId) {
      const reader = wireHostRegistration(catalogOf(), scratch.dir).pluginRegistries.get(tool);
      if (reader === undefined) throw new Error(`no reader declared for ${tool}`);
      return reader;
    },
  };
}
