import path from "node:path";
import type {
  RecipeDirectory,
  RecipeFiles,
  RecipeSource,
} from "../../../../src/contexts/recipes/ports/recipe-files.js";

function failure(code: string): Error {
  return Object.assign(new Error(code), { code });
}

/** Recipe files held in memory: a file, an empty directory, or a file that cannot be read. */
export class InMemoryRecipeFiles implements RecipeFiles {
  private readonly files = new Map<string, string>();
  private readonly directories = new Set<string>();
  private readonly denied = new Map<string, string>();

  addFile(file: string, content: string): this {
    this.files.set(file, content);
    return this;
  }

  addDirectory(directory: string): this {
    this.directories.add(directory);
    return this;
  }

  deny(file: string, code: string): this {
    this.denied.set(file, code);
    return this;
  }

  read(file: string, contentRequired = true): RecipeSource {
    const denied = this.denied.get(file);
    if (denied !== undefined) return { kind: "unreadable", code: denied };
    const content = this.files.get(file);
    if (content !== undefined) {
      return { kind: "readable", content: contentRequired ? content : "" };
    }
    return { kind: "unreadable", code: this.isDirectory(file) ? "EISDIR" : "ENOENT" };
  }

  list(directory: RecipeDirectory): string[] {
    if (this.files.has(directory.path)) throw failure("ENOTDIR");
    if (!this.isDirectory(directory.path)) {
      if (directory.optional) return [];
      throw failure("ENOENT");
    }
    return [...this.files.keys()].filter(
      (file) =>
        path.dirname(file) === directory.path &&
        file.endsWith(".md") &&
        path.basename(file) !== "README.md"
    );
  }

  private isDirectory(candidate: string): boolean {
    return (
      this.directories.has(candidate) ||
      [...this.files.keys()].some((file) => path.dirname(file) === candidate)
    );
  }
}
