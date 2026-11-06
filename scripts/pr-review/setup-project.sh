#!/usr/bin/env bash
set -euo pipefail

# Install the project's recorded AIDD version and available plugins outside its checkout.
[[ $# == 2 ]] || { echo 'Usage: setup-project.sh PROJECT_DIR TARGET_DIR' >&2; exit 2; }
[[ -d $1 && ! -L $1 && -d $2 && ! -L $2 ]] || { echo 'Project and target must be directories' >&2; exit 1; }
project=$(cd "$1" && pwd -P)
target=$(cd "$2" && pwd -P)
[[ $target != "$project" && $target != "$project"/* && -z $(ls -A "$target") ]] || {
  echo 'Target must be an empty directory outside the project' >&2; exit 1;
}
manifest="$project/.aidd/manifest.json"
[[ ! -L $project/.aidd && ! -L $manifest ]] || { echo 'Manifest must not be a symlink' >&2; exit 1; }
version=latest
plugins='[]'
if [[ -e $manifest ]]; then
  [[ -f $manifest ]] && jq -e 'type == "object" and (.tools | type == "object")' "$manifest" >/dev/null || {
    echo 'Invalid project manifest' >&2; exit 1;
  }
  version=$(jq -r '
    if .tools.opencode != null then .tools.opencode.version // empty
    else [.tools[] | .version] as $versions |
      if ($versions | length) > 0 and all($versions[]; type == "string" and length > 0) and ($versions | unique | length) == 1
      then $versions[0] else empty end
    end
  ' "$manifest")
  [[ $version =~ ^v?[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$ ]] || {
    echo 'Project manifest has no unambiguous CLI version' >&2; exit 1;
  }
  if jq -e '.tools.opencode != null' "$manifest" >/dev/null; then
    jq -e '.tools.opencode.plugins == null or (.tools.opencode.plugins | type == "array")' "$manifest" >/dev/null || {
      echo 'Invalid OpenCode plugin inventory' >&2; exit 1;
    }
    plugins=$(jq -c '.tools.opencode.plugins // []' "$manifest")
  else
    jq -e 'all(.tools[]; .plugins == null or (.plugins | type == "array"))' "$manifest" >/dev/null || {
      echo 'Invalid plugin inventory' >&2; exit 1;
    }
    plugins=$(jq -c '[.tools[] | (.plugins // [])[]] | unique' "$manifest")
    echo 'OpenCode plugin inventory unavailable; using recorded plugins from other tools.' >&2
  fi
else
  echo 'Project manifest absent; using latest. Plugin inventory unavailable.' >&2
fi

jq -e 'type == "array" and all(.[]; type == "object" and (.name | type == "string" and test("^[a-z0-9]+(-[a-z0-9]+)*$")))' <<<"$plugins" >/dev/null || {
  echo 'Invalid plugin name in project manifest' >&2; exit 1;
}
names=()
while IFS= read -r plugin; do
  name=$(jq -r .name <<<"$plugin")
  if jq -e '.marketplace == "aidd-framework" or
      ((.source | type) == "object" and .source.kind == "git-subdir" and .source.url == "https://github.com/ai-driven-dev/framework.git" and .source.path == ("plugins/" + .name))' <<<"$plugin" >/dev/null; then
    # Resolve by name from the official catalog; never execute a recorded local path.
    [[ $name != all && $name != none && $name != recommended ]] || {
      echo "Unsupported plugin name: $name" >&2; exit 1;
    }
    if [[ ! " ${names[*]} " == *" $name "* ]]; then names+=("$name"); fi
  else
    echo "Unsupported plugin source for $name; plugin not installed." >&2
  fi
done < <(jq -c '.[]' <<<"$plugins")

if [[ $(jq 'length' <<<"$plugins") == 0 && -e $manifest ]]; then
  echo 'Plugin inventory unavailable in the project manifest.' >&2
fi
plugin_args=none
if ((${#names[@]})); then
  plugin_args=$(IFS=,; echo "${names[*]}")
  echo 'Using the current default catalog; recorded plugin sources are not executed.' >&2
fi
echo "Installing AIDD CLI $version for OpenCode."
scratch=$(mktemp -d "${TMPDIR:-/tmp}/aidd-project-setup.XXXXXXXX")

# The CLI can write its GitHub token into Git cache configs. Scrub every regular
# file without following symlinks before printing logs or removing the scratch.
scrub() {
  node - "$scratch" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const token = process.env.AIDD_TOKEN;
if (!token) process.exit(0);
const needles = [token, Buffer.from(`x-access-token:${token}`).toString('base64')].map((s) => Buffer.from(s));
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) { walk(file); continue; }
    if (!entry.isFile()) continue;
    let data = fs.readFileSync(file);
    let changed = false;
    for (const needle of needles) {
      const chunks = [];
      let start = 0, at;
      while ((at = data.indexOf(needle, start)) !== -1) {
        chunks.push(data.subarray(start, at), Buffer.from('[REDACTED]'));
        start = at + needle.length;
        changed = true;
      }
      if (start) { chunks.push(data.subarray(start)); data = Buffer.concat(chunks); }
    }
    if (changed) fs.writeFileSync(file, data);
  }
}
try { walk(process.argv[2]); }
catch { console.error('Could not sanitize temporary AIDD files'); process.exit(1); }
NODE
}
cleanup() {
  if ! scrub; then
    echo "Temporary AIDD files retained for cleanup: $scratch" >&2
    return 1
  fi
  if [[ $(uname -s) == Darwin ]]; then trash "$scratch"; else rm -rf -- "$scratch"; fi
}
trap cleanup EXIT
mkdir -p "$scratch/setup" "$scratch/source/.claude-plugin" "$scratch/source/plugins" "$scratch/translated"
result=0
(
  cd "$scratch/setup"
  npx --yes "@ai-driven-dev/cli@$version" setup --source remote --ai opencode --plugins "$plugin_args" --yes
) > "$scratch/setup.log" 2>&1 || result=$?
scrub || { echo 'AIDD setup output withheld because sanitization failed' >&2; exit 1; }
cat "$scratch/setup.log"
[[ $result == 0 ]] || { echo 'AIDD setup failed' >&2; exit "$result"; }

if ((${#names[@]})); then
  installed="$scratch/setup/.aidd/manifest.json"
  [[ -f $installed ]] && jq -e '.tools.opencode.plugins | type == "array"' "$installed" >/dev/null || {
    echo 'Cannot verify installed plugin versions' >&2; exit 1;
  }
  for name in "${names[@]}"; do
    actual=$(jq -r --arg name "$name" '[.tools.opencode.plugins[] | select(.name == $name) | .version | select(type == "string" and test("^v?[0-9]+\\.[0-9]+\\.[0-9]+(-[0-9A-Za-z.-]+)?(\\+[0-9A-Za-z.-]+)?$"))] | first // empty' "$installed")
    [[ -n $actual ]] || { echo "Plugin $name was not installed" >&2; exit 1; }
    recorded=$(jq -r --arg name "$name" '[.[] | select(.name == $name) | .version | select(type == "string" and test("^v?[0-9]+\\.[0-9]+\\.[0-9]+(-[0-9A-Za-z.-]+)?(\\+[0-9A-Za-z.-]+)?$"))] | unique | join(", ")' <<<"$plugins")
    if [[ -z $recorded ]]; then
      echo "Recorded version unavailable for $name; installed $actual." >&2
    elif [[ $recorded != "$actual" ]]; then
      echo "Plugin $name version differs: recorded $recorded, installed $actual." >&2
    fi
    [[ -d $scratch/setup/.aidd/plugin-cache ]] || { echo "Plugin source unavailable for $name" >&2; exit 1; }
    plugin_dir=$(find "$scratch/setup/.aidd/plugin-cache" -path "*/plugins/$name" -type d -print -quit)
    [[ -n $plugin_dir ]] || { echo "Plugin source unavailable for $name" >&2; exit 1; }
    [[ -z $(find "$plugin_dir" -type l -print -quit) ]] || { echo "Plugin source contains symlinks: $name" >&2; exit 1; }
    cp -R "$plugin_dir" "$scratch/source/plugins/$name"
  done

  jq -n --arg plugins "$plugin_args" '{name:"aidd-framework",plugins:($plugins | split(",") | map({name:.}))}' > "$scratch/source/.claude-plugin/marketplace.json"
  result=0
  env -u AIDD_TOKEN npx --yes "@ai-driven-dev/cli@$version" translate "$scratch/source" \
    --to opencode --as flat --out "$scratch/translated" > "$scratch/translate.log" 2>&1 || result=$?
  scrub || { echo 'AIDD translate output withheld because sanitization failed' >&2; exit 1; }
  cat "$scratch/translate.log"
  [[ $result == 0 ]] || { echo 'AIDD translation failed' >&2; exit "$result"; }
  for name in "${names[@]}"; do
    source_skills="$scratch/source/plugins/$name/skills"
    translated_skills="$scratch/translated/.opencode/skills/$name"
    if [[ -d $source_skills && -n $(find "$source_skills" -name SKILL.md -type f -print -quit) ]]; then
      [[ -d $translated_skills && -n $(find "$translated_skills" -name SKILL.md -type f -print -quit) ]] || {
        echo "Translated skills are missing for $name" >&2; exit 1;
      }
    fi
  done
fi

mkdir -p "$target/.opencode/skills" "$target/.opencode/agents"
for component in skills agents; do
  source_dir="$scratch/translated/.opencode/$component"
  [[ -d $source_dir ]] || continue
  [[ -z $(find "$source_dir" -type l -print -quit) ]] || { echo "Translated $component contain symlinks" >&2; exit 1; }
  cp -R "$source_dir/." "$target/.opencode/$component/"
done
