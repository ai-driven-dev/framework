/**
 * The import rules of the file-kind gate. `kind-imports.ts` holds the rules; this file holds the
 * tree to them and each rule to the case it names. No violation is tolerated.
 */
import { readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { describe, expect, it } from "vitest";
import { ALLOWED } from "./allowed-edges.js";
import { importViolations } from "./kind-imports.js";
import { codeFilesUnder } from "./kind-tree.js";
import { CLI_ROOT } from "./source-graph.js";

function importsOf(files: Record<string, string>): string[] {
  return importViolations(files).map((violation) => violation.entry);
}

describe("a file imports only the kinds its kind allows", () => {
  it("flags a model that imports a use case", () => {
    expect(
      importsOf({
        "src/contexts/a/domain/x.model.ts": 'import { Y } from "../application/y.use-case.js";',
        "src/contexts/a/application/y.use-case.ts": "export class Y {}",
      })
    ).toEqual(["src/contexts/a/domain/x.model.ts -> src/contexts/a/application/y.use-case.ts"]);
  });

  it("reads an unsuffixed file by its folder", () => {
    expect(
      importsOf({
        "src/contexts/a/domain/x.ts": 'import { Y } from "../ports/y.js";',
        "src/contexts/a/ports/y.ts": "export interface Y {}",
      })
    ).toEqual(["src/contexts/a/domain/x.ts -> src/contexts/a/ports/y.ts"]);
  });

  it("names the file, the rule and the fix", () => {
    const [violation] = importViolations({
      "src/contexts/a/domain/x.model.ts": 'import { Y } from "../application/y.use-case.js";',
      "src/contexts/a/application/y.use-case.ts": "export class Y {}",
    });
    expect(violation?.rule).toBe("imports");
    expect(violation?.message).toContain("src/contexts/a/domain/x.model.ts");
    expect(violation?.message).toMatch(/model may not import a use-case/);
    expect(violation?.message).toMatch(/Fix:/);
  });

  it("passes a use case that imports a port, a model and an error", () => {
    expect(
      importsOf({
        "src/contexts/a/application/x.use-case.ts":
          'import type { P } from "../ports/p.port.js";\nimport { M } from "../domain/m.model.js";\nimport { E } from "../domain/a.error.js";',
        "src/contexts/a/ports/p.port.ts": "export interface P {}",
        "src/contexts/a/domain/m.model.ts": "export const M = 1;",
        "src/contexts/a/domain/a.error.ts": "export class E {}",
      })
    ).toEqual([]);
  });

  it("passes a model, a profile and a presenter that read an error, and a controller that imports one", () => {
    const error = { "src/shared/domain/shared.error.ts": "export class E {}" };
    const importing = (file: string, up: string) => ({
      ...error,
      [file]: `import { E } from "${up}shared/domain/shared.error.js";`,
    });
    expect(importsOf(importing("src/contexts/tools/domain/x.model.ts", "../../../"))).toEqual([]);
    expect(
      importsOf(importing("src/contexts/tools/domain/profiles/x/x.profile.ts", "../../../../../"))
    ).toEqual([]);
    expect(importsOf(importing("src/presentation/presenters/x.presenter.ts", "../../"))).toEqual(
      []
    );
    expect(importsOf(importing("src/presentation/controllers/x.controller.ts", "../../"))).toEqual(
      []
    );
  });

  it("flags a node builtin a model may not use, and passes node:path", () => {
    const files = (builtin: string) => ({
      "src/contexts/a/domain/x.model.ts": `import { f } from "${builtin}";`,
    });
    expect(importsOf(files("node:fs"))).toEqual(["src/contexts/a/domain/x.model.ts -> node:fs"]);
    expect(importsOf(files("node:path"))).toEqual([]);
  });

  it("flags a package a port may not use", () => {
    expect(importsOf({ "src/contexts/a/ports/p.port.ts": 'import x from "smol-toml";' })).toEqual([
      "src/contexts/a/ports/p.port.ts -> smol-toml",
    ]);
  });

  it("lets an adapter use any builtin", () => {
    expect(
      importsOf({
        "src/contexts/a/infrastructure/x.adapter.ts":
          'import { readFile } from "node:fs/promises";',
      })
    ).toEqual([]);
  });

  it("flags a context that reaches into another context past its contract", () => {
    expect(
      importsOf({
        "src/contexts/translate/application/x.use-case.ts":
          'import { M } from "../../tools/domain/m.model.js";',
        "src/contexts/tools/domain/m.model.ts": "export const M = 1;",
      })
    ).toEqual([
      "src/contexts/translate/application/x.use-case.ts -> src/contexts/tools/domain/m.model.ts",
    ]);
  });

  it("flags an edge the context map does not admit, even through a contract", () => {
    expect(
      importsOf({
        "src/contexts/tools/application/x.use-case.ts":
          'import { M } from "../../translate/contract/m.model.js";',
        "src/contexts/translate/contract/m.model.ts": "export const M = 1;",
      })
    ).toEqual([
      "src/contexts/tools/application/x.use-case.ts -> src/contexts/translate/contract/m.model.ts",
    ]);
  });

  it("flags a context that reaches presentation, and shared that reaches a context", () => {
    expect(
      importsOf({
        "src/contexts/tools/application/x.use-case.ts":
          'import { P } from "../../../presentation/p.presenter.js";',
        "src/presentation/p.presenter.ts": "export const P = 1;",
        "src/shared/domain/s.model.ts":
          'import { M } from "../../contexts/tools/contract/m.model.js";',
        "src/contexts/tools/contract/m.model.ts": "export const M = 1;",
      })
    ).toEqual([
      "src/contexts/tools/application/x.use-case.ts -> src/presentation/p.presenter.ts",
      "src/shared/domain/s.model.ts -> src/contexts/tools/contract/m.model.ts",
    ]);
  });

  it("lets presentation reach a context and every layer reach shared", () => {
    expect(
      importsOf({
        "src/presentation/p.presenter.ts":
          'import { M } from "../contexts/tools/contract/m.model.js";',
        "src/contexts/tools/contract/m.model.ts":
          'import { S } from "../../../shared/domain/s.model.js";',
        "src/shared/domain/s.model.ts": "export const S = 1;",
      })
    ).toEqual([]);
  });

  it("holds the context map to a graph without a cycle", () => {
    const reaches = (from: string, seen = new Set<string>()): Set<string> => {
      for (const edge of ALLOWED) {
        const [source = "", target = ""] = edge.split("->");
        if (source === from && !seen.has(target)) reaches(target, seen.add(target));
      }
      return seen;
    };
    const cyclic = [...ALLOWED].filter((edge) => {
      const [source = "", target = ""] = edge.split("->");
      return reaches(target).has(source);
    });
    expect(cyclic, "a context map edge that closes a cycle").toEqual([]);
  });

  it("passes a context that reaches into another through its contract", () => {
    expect(
      importsOf({
        "src/contexts/translate/application/x.use-case.ts":
          'import { M } from "../../tools/contract/m.model.js";',
        "src/contexts/tools/contract/m.model.ts": "export const M = 1;",
      })
    ).toEqual([]);
  });

  it("flags a presenter and a controller that import an adapter", () => {
    expect(
      importsOf({
        "src/presentation/presenters/a.presenter.ts":
          'import { G } from "../../shared/infrastructure/g.adapter.js";',
        "src/presentation/controllers/a.controller.ts":
          'import { G } from "../../shared/infrastructure/g.adapter.js";',
        "src/shared/infrastructure/g.adapter.ts": "export const G = 1;",
      })
    ).toEqual([
      "src/presentation/presenters/a.presenter.ts -> src/shared/infrastructure/g.adapter.ts",
      "src/presentation/controllers/a.controller.ts -> src/shared/infrastructure/g.adapter.ts",
    ]);
  });

  it("flags a profile that imports outside tools and shared", () => {
    expect(
      importsOf({
        "src/contexts/tools/domain/profiles/x/x.profile.ts":
          'import { M } from "../../../../installation/domain/m.model.js";',
        "src/contexts/installation/domain/m.model.ts": "export const M = 1;",
      })
    ).toEqual([
      "src/contexts/tools/domain/profiles/x/x.profile.ts -> src/contexts/installation/domain/m.model.ts",
    ]);
  });

  it("flags a profile that imports a file of another profile, and passes its own folder", () => {
    const base = "src/contexts/tools/domain/profiles";
    expect(
      importsOf({
        [`${base}/x/x.profile.ts`]:
          'import { Y } from "../y/y.profile.js";\nimport { Z } from "./z.js";',
        [`${base}/y/y.profile.ts`]: "export const Y = 1;",
        [`${base}/x/z.ts`]: "export const Z = 1;",
      })
    ).toEqual([`${base}/x/x.profile.ts -> ${base}/y/y.profile.ts`]);
  });

  it("flags composition imported by anything but composition", () => {
    expect(
      importsOf({
        "src/presentation/controllers/x.controller.ts":
          'import { wire } from "../../composition/a.composition.js";',
        "src/composition/a.composition.ts": "export const wire = 1;",
      })
    ).toEqual(["src/presentation/controllers/x.controller.ts -> src/composition/a.composition.ts"]);
  });

  it("flags a fake that imports another context's kit", () => {
    expect(
      importsOf({
        "tests/contexts/a/testing/x.fake.ts": 'import { Y } from "../../b/testing/y.fake.js";',
        "tests/contexts/b/testing/y.fake.ts": "export class Y {}",
      })
    ).toEqual(["tests/contexts/a/testing/x.fake.ts -> tests/contexts/b/testing/y.fake.ts"]);
  });

  it("flags a test of a context and the shared kit that import another context's kit", () => {
    const kit = {
      "tests/contexts/b/testing/y.fake.ts": "export class Y {}",
    };
    for (const file of ["tests/contexts/a/x/y.unit.test.ts", "tests/shared/testing/h.ts"]) {
      const target = "tests/contexts/b/testing/y.fake.ts";
      const spec = posix.relative(posix.dirname(file), target).replace(/\.ts$/, ".js");
      expect(importsOf({ ...kit, [file]: `import { Y } from "${spec}";` })).toEqual([
        `${file} -> ${target}`,
      ]);
    }
  });

  it("lets orchestration tests and a context's own tests import the kits they compose", () => {
    expect(
      importsOf({
        "tests/contexts/b/testing/y.fake.ts": "export class Y {}",
        "tests/composition/c.unit.test.ts": 'import { Y } from "../contexts/b/testing/y.fake.js";',
        "tests/contexts/b/x/y.unit.test.ts": 'import { Y } from "../testing/y.fake.js";',
      })
    ).toEqual([]);
  });

  it("flags a setup file imported by a test, a kit or a source, as only a vitest config loads it", () => {
    for (const file of [
      "tests/contexts/a/x/y.unit.test.ts",
      "tests/contexts/a/testing/x.fake.ts",
      "tests/shared/testing/h.ts",
      "src/presentation/x.ts",
    ]) {
      const target = "tests/setup/loader.ts";
      const spec = posix.relative(posix.dirname(file), target).replace(/\.ts$/, ".js");
      expect(
        importsOf({
          [target]: "export const loader = 1;",
          [file]: `import { loader } from "${spec}";`,
        })
      ).toEqual([`${file} -> ${target}`]);
    }
  });

  it("passes a fake that imports the shared kit and its own source", () => {
    expect(
      importsOf({
        "tests/contexts/a/testing/x.fake.ts":
          'import { Y } from "../../../shared/testing/y.fake.js";\nimport { P } from "../../../../src/contexts/a/ports/p.port.js";',
        "tests/shared/testing/y.fake.ts": "export class Y {}",
        "src/contexts/a/ports/p.port.ts": "export interface P {}",
      })
    ).toEqual([]);
  });

  it("holds every import of the tree, with no violation", () => {
    const files: Record<string, string> = {};
    for (const path of [...codeFilesUnder("src"), ...codeFilesUnder("tests")]) {
      files[path] = readFileSync(join(CLI_ROOT, path), "utf8");
    }
    expect(importViolations(files).map((violation) => violation.message)).toEqual([]);
  });
});
