/**
 * Presentation parses arguments and displays results. A command or an adapter is built in
 * `composition/` and handed in, so a command never decides which adapter backs it. `SetupFlow` is
 * a validating value object the setup command still builds: moving it would reorder the
 * validation errors against the banner, so it is the one name left out.
 */
import { describe, expect, it } from "vitest";
import { read, sourceFiles, tsFilesUnder } from "./helpers.js";

const VALUE_OBJECTS = new Set(["SetupFlow"]);
const BUILT_IN_COMPOSITION =
  /^src\/(?:orchestration\/|contexts\/[^/]+\/(?:application|infrastructure)\/|shared\/infrastructure\/)/;
const CLASS_DECLARATION = /^export (?:abstract )?class (\w+)/gm;

function composedClassNames(): string[] {
  const names = sourceFiles()
    .filter((file) => BUILT_IN_COMPOSITION.test(file))
    .flatMap((file) => [...read(file).matchAll(CLASS_DECLARATION)].flatMap((m) => m.slice(1)));
  return [...new Set(names)].filter((name) => !VALUE_OBJECTS.has(name)).sort();
}

function constructedIn(text: string, names: readonly string[]): string[] {
  return names.filter((name) => new RegExp(`\\bnew ${name}\\(`).test(text));
}

describe("presentation constructs no command or adapter", () => {
  const names = composedClassNames();

  it("names the classes composition builds", () => {
    expect(names).toContain("MenuLoop");
    expect(names).not.toContain("SetupFlow");
  });

  it("finds a command built in presentation", () => {
    expect(constructedIn("const menu = new MenuLoop(a, b, c);", names)).toEqual(["MenuLoop"]);
  });

  it("builds none of them in presentation or in the binary entry", () => {
    const files = [...tsFilesUnder("src/presentation"), "src/cli.ts"];
    const violations = files.flatMap((file) =>
      constructedIn(read(file), names).map((name) => `${file}: new ${name}(`)
    );

    expect(violations).toEqual([]);
  });
});
