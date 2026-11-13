import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { RecipeFilesAdapter } from "../../../../src/contexts/recipes/infrastructure/recipe-files-adapter.js";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aidd-recipe-adapter-"));
const file = path.join(directory, "recipe.md");
fs.writeFileSync(file, "# Recipe\n", "utf8");

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(() => {
  fs.rmSync(directory, { recursive: true, force: true });
});

/** Every descriptor opened on the recipe, and every one closed, as the adapter used them. */
function watchDescriptors(): { opened: Set<number>; closed: number[] } {
  const open = fs.openSync;
  const close = fs.closeSync;
  const opened = new Set<number>();
  const closed: number[] = [];
  vi.spyOn(fs, "openSync").mockImplementation((target, ...args) => {
    const descriptor = open(target, ...args);
    if (target === file) opened.add(descriptor);
    return descriptor;
  });
  vi.spyOn(fs, "closeSync").mockImplementation((descriptor) => {
    closed.push(descriptor);
    return close(descriptor);
  });
  return { opened, closed };
}

describe("a recipe read through the disk", () => {
  it("is reported unreadable with the code, and its descriptor is closed", () => {
    const { opened, closed } = watchDescriptors();
    vi.spyOn(fs, "readFileSync").mockImplementation(() => {
      throw Object.assign(new Error("Permission denied"), { code: "EACCES" });
    });
    expect(new RecipeFilesAdapter().read(file)).toEqual({ kind: "unreadable", code: "EACCES" });
    expect([...opened]).toEqual(closed);
    expect(closed).toHaveLength(1);
  });

  it("is not decoded when its content is not required, and its descriptor is closed", () => {
    const { opened, closed } = watchDescriptors();
    const decode = vi.spyOn(fs, "readFileSync");
    expect(new RecipeFilesAdapter().read(file, false)).toEqual({ kind: "readable", content: "" });
    expect(decode).not.toHaveBeenCalled();
    expect([...opened]).toEqual(closed);
    expect(closed).toHaveLength(1);
  });
});
