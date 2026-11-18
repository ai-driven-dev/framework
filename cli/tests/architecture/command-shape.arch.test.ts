/**
 * A command is one file holding one class of the same name, with a public `execute` and no
 * `UseCase` suffix.
 */
import { describe, expect, it } from "vitest";
import { commandFiles, commandSourceOf, KNOWN_COMMAND_FILE, read } from "./helpers.js";

function pascalCase(kebab: string): string {
  return kebab
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function classNameOf(file: string): string {
  return pascalCase(file.replace(/^.*\//, "").replace(/\.ts$/, ""));
}

/** What breaks the command shape in one file, empty when it holds no command. */
function commandShapeBreaks(file: string, source: string): string[] {
  const { classes, executes, hidesExecute } = commandSourceOf(source);
  // A port file declares `execute` on an interface and no class: it holds no command to shape.
  if (!executes || classes.length === 0) return [];
  const breaks: string[] = [];
  if (classes.length !== 1) {
    breaks.push(`${file}: ${classes.length} classes, expected one`);
  }
  if (!classes.includes(classNameOf(file))) {
    breaks.push(`${file}: no class named ${classNameOf(file)}`);
  }
  if (classes.some((name) => name.endsWith("UseCase"))) {
    breaks.push(`${file}: a UseCase suffix`);
  }
  if (hidesExecute) {
    breaks.push(`${file}: an execute that is not public`);
  }
  return breaks;
}

describe("a command is one file, one class of the same name", () => {
  it("every command of the tree has the shape", () => {
    const candidates = commandFiles();
    expect(candidates, "the rule selects no known command: its scope is stale").toContain(
      KNOWN_COMMAND_FILE
    );
    expect(candidates.flatMap((file) => commandShapeBreaks(file, read(file)))).toEqual([]);
  });

  describe("plant", () => {
    const file = "src/orchestration/x-y.ts";

    it("clears a command named after its file", () => {
      expect(commandShapeBreaks(file, "export class XY { execute() {} }")).toEqual([]);
    });

    it("flags a UseCase suffix", () => {
      expect(commandShapeBreaks(file, "export class XYUseCase { execute() {} }")).toContain(
        `${file}: a UseCase suffix`
      );
    });

    it("flags a suffix on a class exported apart from its declaration", () => {
      const source = "class LogOutUseCase { execute() {} }\nexport { LogOutUseCase };";
      expect(commandShapeBreaks("src/orchestration/log-out.ts", source)).toContain(
        "src/orchestration/log-out.ts: a UseCase suffix"
      );
    });

    it("flags a name that does not follow the file", () => {
      expect(commandShapeBreaks(file, "export class Z { execute() {} }")).toContain(
        `${file}: no class named XY`
      );
    });

    it("flags a second class, exported or not", () => {
      expect(commandShapeBreaks(file, "export class XY { execute() {} }\nclass Q {}")).toContain(
        `${file}: 2 classes, expected one`
      );
    });

    it.each(["private", "protected"])("flags a %s execute", (modifier) => {
      expect(commandShapeBreaks(file, `export class XY { ${modifier} execute() {} }`)).toContain(
        `${file}: an execute that is not public`
      );
    });

    it("clears an explicitly public async execute", () => {
      expect(commandShapeBreaks(file, "export class XY { public async execute() {} }")).toEqual([]);
    });

    it("leaves an interface that declares execute alone", () => {
      expect(commandShapeBreaks(file, "export interface Ensurer { execute(): void }")).toEqual([]);
    });

    it("leaves a file without execute alone", () => {
      expect(commandShapeBreaks(file, "export class A {}\nexport class B {}")).toEqual([]);
    });
  });
});
