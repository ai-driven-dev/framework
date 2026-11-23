import { join } from "node:path";
import type {
  EnvironmentReader,
  HomePath,
  HomeTemplate,
} from "../../contract/native-registration-spec.js";

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
