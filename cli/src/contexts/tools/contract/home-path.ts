import { join } from "node:path";

/** A path under the home directory, declared as data: a template, or a directory an environment
 * variable names, with a template to fall back on, and the file name under it. */
export type HomePath =
  | HomeTemplate
  | { readonly env: string; readonly fallback: HomeTemplate; readonly fileName: string };

/** A `/`-separated path whose `{home}` segment stands for the home directory. */
export type HomeTemplate = string;

/** Reads one environment variable, undefined when it is unset. */
export type EnvironmentReader = (name: string) => string | undefined;

const HOME_SEGMENT = "{home}";

/** The path a template names under `home`. */
export function resolveHomeTemplate(template: HomeTemplate, home: string): string {
  return join(...template.split("/").map((segment) => (segment === HOME_SEGMENT ? home : segment)));
}

/** The path a declaration names under `home`. An empty variable counts as unset. */
export function resolveHomePath(path: HomePath, home: string, env: EnvironmentReader): string {
  if (typeof path === "string") return resolveHomeTemplate(path, home);
  return join(env(path.env) || resolveHomeTemplate(path.fallback, home), path.fileName);
}
