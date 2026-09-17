import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { errnoError, FaultingFileAdapter } from "./faulting-file-adapter.js";
import { InMemoryFileAdapter } from "./in-memory-file-adapter.js";

vi.mock("node:path", async (importOriginal) => {
  const path = await importOriginal<typeof import("node:path")>();
  return {
    ...path,
    resolve: (...segments: string[]) => path.win32.resolve("C:\\workspace", ...segments),
  };
});

describe("Windows realpath fixtures", () => {
  it("resolves a rooted fixture's symlink after the caller adds the current drive", async () => {
    const fs = new InMemoryFileAdapter();
    fs.setSymlink("/project/link", "/foreign");

    expect(await fs.realpath(resolve("/project/link/file"))).toBe(
      resolve("/foreign/file").replaceAll("\\", "/")
    );
  });

  it("preserves a registered realpath fault when the caller resolves the fixture path", async () => {
    const fs = new FaultingFileAdapter();
    const error = errnoError("ENOENT");
    fs.failOn("realpath", "/project/missing", error);

    await expect(fs.realpath(resolve("/project/missing"))).rejects.toBe(error);
  });
});
