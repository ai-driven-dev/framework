import fs from "node:fs";
import path from "node:path";
import type { RecipeDirectory, RecipeFiles, RecipeSource } from "../domain/ports/recipe-files.js";

function errorCode(error: unknown): string {
  if (error instanceof Error && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return error instanceof Error ? error.message : String(error);
}

export class RecipeFilesAdapter implements RecipeFiles {
  read(file: string, contentRequired = true): RecipeSource {
    let descriptor: number | undefined;
    try {
      descriptor = fs.openSync(file, "r");
      if (!fs.fstatSync(descriptor).isFile()) return { kind: "unreadable", code: "EISDIR" };
      return {
        kind: "readable",
        content: contentRequired ? fs.readFileSync(descriptor, "utf8") : "",
      };
    } catch (error) {
      // Readability is a recipe/link validation result, never a silent successful read.
      return { kind: "unreadable", code: errorCode(error) };
    } finally {
      if (descriptor !== undefined) fs.closeSync(descriptor);
    }
  }

  list(directory: RecipeDirectory): string[] {
    try {
      return fs
        .readdirSync(directory.path, { withFileTypes: true })
        .filter(
          (entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md"
        )
        .map((entry) => path.join(directory.path, entry.name));
    } catch (error) {
      if (directory.optional && errorCode(error) === "ENOENT") return [];
      throw error;
    }
  }
}
