import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InvalidManifestDataError } from "../../../../src/contexts/installation/domain/installation.error.js";
import { Manifest } from "../../../../src/contexts/installation/domain/manifest.js";
import {
  readManifestFile,
  writeManifestFile,
} from "../../../../src/contexts/installation/infrastructure/manifest-file-io.js";
import { resolveRegisteredToolId, TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { saying } from "../../../shared/testing/saying.builder.js";

describe("manifest file io", () => {
  let dir: string;
  let path: string;
  const contextOf = (file: string) => ({
    path: file,
    location: "in this project",
    reinstallCommand: "aidd setup",
  });

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "aidd-manifest-io-"));
    path = join(dir, ".aidd", "manifest.json");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("reads a missing file as no manifest", async () => {
    expect(await readManifestFile(contextOf(path), resolveRegisteredToolId)).toBeNull();
  });

  it("creates the parent directory on write, so a manifest round-trips through the file", async () => {
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "1.0.0", []);

    await writeManifestFile(path, manifest);
    const loaded = await readManifestFile(contextOf(path), resolveRegisteredToolId);

    expect(loaded?.getInstalledToolIds()).toStrictEqual([TOOL.claude]);
  });

  it("writes the manifest as indented JSON", async () => {
    await writeManifestFile(path, Manifest.create());

    expect(await readFile(path, "utf-8")).toBe(JSON.stringify(Manifest.create().toJSON(), null, 2));
  });

  it("overwrites what a previous write left", async () => {
    const first = Manifest.create();
    first.addTool(TOOL.claude, "1.0.0", []);
    await writeManifestFile(path, first);

    await writeManifestFile(path, Manifest.create());

    const loaded = await readManifestFile(contextOf(path), resolveRegisteredToolId);
    expect(loaded?.getInstalledToolIds()).toStrictEqual([]);
  });

  it("names the file when its content is not JSON", async () => {
    await mkdir(join(dir, ".aidd"));
    await writeFile(path, '{"version": 8, "tools": {');

    const read = readManifestFile(contextOf(path), resolveRegisteredToolId);

    await expect(read).rejects.toThrow(InvalidManifestDataError);
    await expect(read).rejects.toThrow(saying(`${path} is not valid JSON`));
  });

  it("names the file and the reinstall command when its version is refused", async () => {
    await mkdir(join(dir, ".aidd"));
    await writeFile(path, '{"version": 1, "tools": {}}');

    await expect(readManifestFile(contextOf(path), resolveRegisteredToolId)).rejects.toThrow(
      saying("aidd setup")
    );
  });

  it("rethrows a read failure other than a missing file", async () => {
    await mkdir(path, { recursive: true });

    await expect(readManifestFile(contextOf(path), resolveRegisteredToolId)).rejects.toThrow(
      "EISDIR"
    );
  });
});
