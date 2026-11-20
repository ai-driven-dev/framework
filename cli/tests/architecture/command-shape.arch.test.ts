/**
 * A command is one file holding one class of the same name, with a public `execute`. No class of
 * the tree, command or not, carries a `UseCase` suffix.
 */
import { describe, expect, it } from "vitest";
import { commandFiles, commandSourceOf, KNOWN_COMMAND_FILE, read, sourceFiles } from "./helpers.js";

function pascalCase(kebab: string): string {
  return kebab
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function classNameOf(file: string): string {
  return pascalCase(file.replace(/^.*\//, "").replace(/\.ts$/, ""));
}

/** Application classes that answer several questions, implement no port or contract and have no
 * `execute`. The list may only shrink: each entry becomes a command, or the code map reclassifies
 * it. */
const COMMAND_SHAPE_BASELINE: readonly string[] = [
  "src/contexts/distribution/application/choose-marketplace-source.ts",
  "src/contexts/installation/application/agents/agent-providers.ts",
  "src/contexts/installation/application/agents/main-session-models.ts",
  "src/contexts/installation/application/clean-project.ts",
  "src/contexts/installation/application/install/config/tracked-config-files.ts",
  "src/contexts/installation/application/install/configure-machine-scope.ts",
  "src/contexts/installation/application/materialize/project-hooks-materializer.ts",
  "src/contexts/installation/application/plugin/plugin-distribution-loader.ts",
  "src/contexts/installation/application/plugin/plugin-materializer.ts",
  "src/contexts/installation/application/purge-user-scope-files.ts",
  "src/contexts/installation/application/removal/project-plugin-withdrawal.ts",
  "src/contexts/installation/application/removal/purge-machine-state.ts",
  "src/contexts/installation/application/removal/remove-project-plugin.ts",
  "src/contexts/installation/application/removal/user-scope-plugin-files.ts",
  "src/contexts/installation/application/resolve-sync-conflict.ts",
  "src/contexts/installation/application/sync/record-activation.ts",
  "src/contexts/installation/application/sync/sync-tool-settings-files.ts",
  "src/contexts/installation/application/sync/tracked-settings-file.ts",
  "src/contexts/machine-claims/application/release-claims.ts",
  "src/contexts/machine-claims/application/shared-source/shared-framework-source.ts",
  "src/contexts/telemetry/application/branch-declarations.ts",
  "src/contexts/telemetry/application/remembered-resolutions.ts",
  "src/contexts/telemetry/application/switch/consent-switch.ts",
  "src/contexts/telemetry/application/switch/remember-own-root.ts",
  "src/contexts/translate/application/sinks/disk-sink.ts",
  // Owed debt: the target merges the flat writer into disk-sink, so no port or command is owed.
  "src/contexts/translate/application/sinks/flat-writer.ts",
  "src/orchestration/global/bulk-conflict-state.ts",
  "src/orchestration/setup/setup-marketplace-registration.ts",
];

/** Classes that answer several questions by design: the code map keeps them as helpers, so no
 * command is owed. Not a debt: an entry stays until its class changes shape. Its own row sits in
 * the reference context's Exceptions. */
const HELPERS_BY_DESIGN: readonly string[] = [
  "src/contexts/telemetry/application/consent-log.ts",
  "src/contexts/telemetry/application/directory-resolver.ts",
];

/** Folders whose commands answer one question through `execute` alone: each step they run is a
 * private function, never a second public method. */
const ONLY_EXECUTE_HOMES: readonly string[] = [
  "src/contexts/host-registration/application/withdraw/",
];

/** What breaks the command shape in one file, empty when it holds no command. */
function commandShapeBreaks(file: string, source: string): string[] {
  const { classes, executes, hidesExecute, publicMethods, implementsInterface } =
    commandSourceOf(source);
  // A port file declares `execute` on an interface and no class: it holds no command to shape.
  if (classes.length === 0) return [];
  const breaks: string[] = [];
  if (!executes) {
    // A class that implements a port or a contract answers the questions that interface names.
    if (
      publicMethods.length > 1 &&
      !implementsInterface &&
      !HELPERS_BY_DESIGN.includes(file) &&
      !COMMAND_SHAPE_BASELINE.includes(file)
    ) {
      breaks.push(`${file}: ${publicMethods.length} public methods and no execute`);
    }
    return breaks;
  }
  if (classes.length !== 1) {
    breaks.push(`${file}: ${classes.length} classes, expected one`);
  }
  if (!classes.includes(classNameOf(file))) {
    breaks.push(`${file}: no class named ${classNameOf(file)}`);
  }
  if (hidesExecute) {
    breaks.push(`${file}: an execute that is not public`);
  }
  const others = publicMethods.filter((name) => name !== "execute");
  if (ONLY_EXECUTE_HOMES.some((home) => file.startsWith(home)) && others.length > 0) {
    breaks.push(`${file}: public methods besides execute: ${others.join(", ")}`);
  }
  return breaks;
}

/** The classes of a file named with the suffix the vocabulary dropped, command or not. */
function useCaseSuffixBreaks(file: string, source: string): string[] {
  return commandSourceOf(source)
    .classes.filter((name) => name.endsWith("UseCase"))
    .map(() => `${file}: a UseCase suffix`);
}

describe("no class carries a UseCase suffix", () => {
  it("every class under src is named for what it is", () => {
    expect(sourceFiles().flatMap((file) => useCaseSuffixBreaks(file, read(file)))).toEqual([]);
  });

  describe("plant", () => {
    it("flags a suffix on a class that is no command, outside a command home", () => {
      expect(useCaseSuffixBreaks("src/presentation/x-y.ts", "export class XYUseCase {}")).toEqual([
        "src/presentation/x-y.ts: a UseCase suffix",
      ]);
    });

    it("flags a suffix on a class exported apart from its declaration", () => {
      const source = "class LogOutUseCase {}\nexport { LogOutUseCase };";
      expect(useCaseSuffixBreaks("src/presentation/log-out.ts", source)).toEqual([
        "src/presentation/log-out.ts: a UseCase suffix",
      ]);
    });
  });
});

describe("a command is one file, one class of the same name", () => {
  it("every command of the tree has the shape", () => {
    const candidates = commandFiles();
    expect(candidates, "the rule selects no known command: its scope is stale").toContain(
      KNOWN_COMMAND_FILE
    );
    expect(candidates.flatMap((file) => commandShapeBreaks(file, read(file)))).toEqual([]);
  });

  it("lists only classes that still answer several questions", () => {
    const stale = [...COMMAND_SHAPE_BASELINE, ...HELPERS_BY_DESIGN].filter((file) => {
      const { classes, executes, publicMethods, implementsInterface } = commandSourceOf(read(file));
      return classes.length === 0 || executes || implementsInterface || publicMethods.length < 2;
    });
    expect(
      stale,
      "a class that is a command now: remove it from COMMAND_SHAPE_BASELINE or HELPERS_BY_DESIGN"
    ).toEqual([]);
  });

  const file = "src/orchestration/x-y.ts";

  describe("plant", () => {
    it("flags a class that answers several questions and has no execute", () => {
      const source = "export class XY {\n  one() {}\n  async two() {}\n  private three() {}\n}";
      expect(commandShapeBreaks(file, source)).toContain(
        `${file}: 2 public methods and no execute`
      );
    });

    it("clears a class that implements a port, whatever its methods", () => {
      const source =
        'import type { Port } from "../shared/ports/port.js";\nexport class XY implements Port {\n  one() {}\n  two() {}\n}';
      expect(commandShapeBreaks(file, source)).toEqual([]);
    });

    it("flags a class that implements an interface its own file declares", () => {
      const source =
        "interface Port {}\nexport class XY implements Port {\n  one() {}\n  two() {}\n}";
      expect(commandShapeBreaks(file, source)).toContain(
        `${file}: 2 public methods and no execute`
      );
    });

    it("clears a class with one public method, and one whose other methods are private", () => {
      expect(commandShapeBreaks(file, "export class XY {\n  one() {}\n}")).toEqual([]);
      expect(
        commandShapeBreaks(file, "export class XY {\n  private one() {}\n  protected two() {}\n}")
      ).toEqual([]);
    });

    it("clears a command named after its file", () => {
      expect(commandShapeBreaks(file, "export class XY { execute() {} }")).toEqual([]);
    });

    it("flags a second public method on a command of a folder that allows execute alone", () => {
      const home = "src/contexts/host-registration/application/withdraw/x-y.ts";
      const source = "export class XY {\n  execute() {}\n  other() {}\n}";
      expect(commandShapeBreaks(home, source)).toContain(
        `${home}: public methods besides execute: other`
      );
      expect(commandShapeBreaks(file, source)).toEqual([]);
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
