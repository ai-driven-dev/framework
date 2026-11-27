// A host adapter, `assets/hooks-runtime/host-<tool>.cjs`, is its template, the part `host-<tool>`, with every
// `// @part <name>` line replaced by the part `<name>`. The repository's host-adapters generator writes the
// committed adapters from these rules; the bundle joins the same parts at load, so each part ships once.
import fs from "node:fs";
import path from "node:path";

const PART_LINE = /^\/\/ @part (\S+)$/mu;
const PARTS = "parts";
const PART_SUFFIX = ".js.txt";
const ADAPTER_SUFFIX = ".cjs";

/** Where the part `name` lives, relative to the hooks runtime directory. */
export const partFile = (name) => `${PARTS}/${name}${PART_SUFFIX}`;

/** Whether the part `name` is a host's template, the one part an adapter is generated from. */
export const isTemplate = (name) => name.startsWith("host-");

/** The adapter the template `name` generates, relative to the hooks runtime directory. */
export const adapterFile = (name) => `${name}${ADAPTER_SUFFIX}`;

/** The template the file `file` is the adapter of, or undefined when it is none. */
export function templateOf(file) {
  const name = path.basename(file, ADAPTER_SUFFIX);
  return adapterFile(name) === path.basename(file) && isTemplate(name) ? name : undefined;
}

/** The name of every part the hooks runtime directory `runtime` holds, sorted; none without its parts. */
export function partNamesIn(runtime) {
  const parts = path.join(runtime, PARTS);
  if (!fs.existsSync(parts)) return [];
  return fs
    .readdirSync(parts)
    .filter((file) => file.endsWith(PART_SUFFIX))
    .map((file) => file.slice(0, -PART_SUFFIX.length))
    .sort();
}

/** A template cut at its part lines: even entries are its own text, odd entries the names of the parts. */
export function splitTemplate(text) {
  return text.split(PART_LINE);
}

/** A part as an adapter holds it: the line break that closed the template's part line closes it. */
export function partText(content) {
  return content.replace(/\n$/u, "");
}

const RUNTIME_FILE = /[\\/]hooks-runtime[\\/][^\\/]+$/;
const PART_FILE = /[\\/]hooks-runtime[\\/]parts[\\/][^\\/]+$/;

/** The esbuild plugin that loads each adapter as its template joined to its parts, one module per part. */
export const joinedHostAdapters = {
  name: "joined-host-adapters",
  setup(build) {
    build.onLoad({ filter: RUNTIME_FILE }, ({ path: adapter }) => {
      const name = templateOf(adapter);
      if (name === undefined) return undefined;
      const runtime = path.dirname(adapter);
      const template = path.join(runtime, partFile(name));
      const imports = [];
      const pieces = splitTemplate(fs.readFileSync(template, "utf8")).map((piece, index) => {
        if (index % 2 === 0) return JSON.stringify(piece);
        imports.push(`import part${index} from ${JSON.stringify(`./${partFile(piece)}`)};`);
        return `part${index}`;
      });
      return {
        contents: `${imports.join("\n")}\nexport default ${pieces.join(" + ")};\n`,
        loader: "js",
        resolveDir: runtime,
        watchFiles: [template],
      };
    });
    build.onLoad({ filter: PART_FILE }, ({ path: part }) => ({
      contents: partText(fs.readFileSync(part, "utf8")),
      loader: "text",
    }));
  },
};
