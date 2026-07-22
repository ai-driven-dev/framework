import { readFileSync } from "node:fs";
import type { Plugin } from "vitest/config";

export function textLoader(extensions: readonly string[]): Plugin {
  return {
    name: "vitest-text-loader",
    enforce: "pre",
    transform(_code, id) {
      const filePath = id.split("?")[0];
      if (!extensions.some((ext) => filePath.endsWith(ext))) return null;
      const content = readFileSync(filePath, "utf-8");
      return { code: `export default ${JSON.stringify(content)};`, map: null };
    },
  };
}
