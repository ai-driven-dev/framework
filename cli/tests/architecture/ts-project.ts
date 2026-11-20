/**
 * The compiler projects the architecture guards read: a real one opened from a `tsconfig.json`,
 * and a virtual one built from files given as text. Each call starts a compiler process and
 * closes it before returning, so a caller reads everything it needs inside `run`.
 */
import { tmpdir } from "node:os";
import type { Node } from "typescript/unstable/ast";
import { createVirtualFileSystem } from "typescript/unstable/fs";
import { API, type Project } from "typescript/unstable/sync";
import { present } from "./present.js";

export function walk(node: Node, visit: (node: Node) => void): void {
  visit(node);
  node.forEachChild((child) => {
    walk(child, visit);
  });
}

function openFirst(api: API, tsconfig: string): Project {
  const [project] = api.updateSnapshot({ openProject: tsconfig }).getProjects();
  if (!project) throw new Error("the compiler opened no project");
  return project;
}

/** The project at `cwd`, read through its `tsconfig.json`. */
export function withRealProject<T>(cwd: string, run: (project: Project) => T): T {
  const api = new API({ cwd });
  try {
    return run(openFirst(api, `${cwd}/tsconfig.json`));
  } finally {
    api.close();
  }
}

/**
 * A project whose files are `files`, a map from a path to its text. `at` gives the absolute path
 * the compiler knows a file by.
 */
export function withVirtualProject<T>(
  name: string,
  files: Readonly<Record<string, string>>,
  compilerOptions: Readonly<Record<string, unknown>>,
  run: (project: Project, at: (path: string) => string) => T
): T {
  const root = `${tmpdir().replaceAll("\\", "/")}/${name}`;
  const at = (path: string) => `${root}/${path}`;
  const paths = Object.keys(files);
  const api = new API({
    cwd: root,
    fs: createVirtualFileSystem({
      [at("tsconfig.json")]: JSON.stringify({ compilerOptions, files: paths.map(at) }),
      ...Object.fromEntries(paths.map((path) => [at(path), present(files[path])])),
    }),
  });
  try {
    return run(openFirst(api, at("tsconfig.json")), at);
  } finally {
    api.close();
  }
}
