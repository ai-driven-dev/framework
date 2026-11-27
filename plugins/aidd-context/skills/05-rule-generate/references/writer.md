# Writer

Run `scripts/write-rule.cjs` to write a rule source under `aidd_docs/rules/` and publish it to each host it targets.

```sh
node "$writer" --project "$project_root" --tools "$host_ids" --input "$request_json"
node "$validator" "$project_root/aidd_docs/rules/$category/$slug.md"
```

- `$writer`: the absolute path of `scripts/write-rule.cjs`, next to the loaded `SKILL.md`.
- `$validator`: the absolute path of `scripts/validate-rule.cjs`, next to the loaded `SKILL.md`; it prints one `path:line RULE-nn message` per finding and nothing when clean.
- `$project_root`: the absolute path of the working directory, copied as the session reports it.
- `$host_ids`: the confirmed IDs from `hosts.md`, comma-separated.
- `$request_json`: a temporary file outside the project holding `category`, `slug`, a one-line `description`, a `body` starting with `# <title>`, and optional `paths`, an array of globs.

Read the selected host's official documentation for requested rule options and pass the documented keys and types in `nativeOptions` under that host ID, for example `{"copilot":{"excludeAgent":"code-review"}}`. [GitHub Copilot custom instructions](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions)

The source keeps an existing host's options until that host receives a replacement map or an empty map to clear them.

Options cannot replace fields managed by the writer or be applied to a host without a per-rule front matter format.

| Option | Effect |
| --- | --- |
| `--input <file>` | Add or update: writes the source, then its copies; `--tools` required. |
| `--remove <category>/<slug>` | Remove: deletes the source, its copies and its index line; host config entries stay. |
| `--publish` | Republishes every source to its own `targets`. |
| `--tools` | Adds hosts to a source's `targets`, never removes one. |
| `--kilo-config <file>` | Selects an existing project-relative Kilo config when several candidates lack the glob. |
| `--opencode-config <file>` | Selects an existing project-relative OpenCode config when several candidates lack the glob. |
| `--plan` | Writes nothing; lists each file with `create`, `update` or `delete`. |
| `--force` | Overwrites each copy the plan lists in `conflicts`; without it, the writer refuses. |

The result is JSON: `files` lists each path and its operation, `conflicts` each copy the writer did not produce, `error` a `{code, message}`. Exit 0 means done; any other exit comes with `error`.

When the preview asks to choose among config files, ask which listed file to update. Rerun with the matching selection flag and keep that flag when applying the approved plan.

The JSONC editor uses the parser bundled with the skill, so an installed copy runs with Node alone.

To regenerate the bundle from the repository root with CLI dependencies installed:

```sh
node --input-type=commonjs - <<'NODE'
const { createRequire } = require("node:module");
const { readFileSync } = require("node:fs");
const { buildSync } = createRequire(require.resolve("./cli/node_modules/tsup/package.json"))("esbuild");
const pkg = "./cli/node_modules/jsonc-parser";
const { version } = require(pkg + "/package.json");
const license = readFileSync(pkg + "/LICENSE.md", "utf8").replace(/\r\n/g, "\n").trim();
buildSync({
  stdin: { contents: 'export { createScanner, parseTree, SyntaxKind } from "' + pkg + '/lib/esm/main.js";', resolveDir: process.cwd() },
  bundle: true, format: "cjs", platform: "node", minify: true, legalComments: "none",
  banner: { js: "/* Generated from https://github.com/microsoft/node-jsonc-parser v" + version + "\n\n" + license + "\n*/" },
  outfile: "plugins/aidd-context/skills/05-rule-generate/scripts/lib/jsonc-parser.cjs",
});
NODE
```
