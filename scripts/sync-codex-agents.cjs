#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

function sync(pluginName, builtAgentsDir, installedDir, previousSnapshotDir) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(pluginName)) throw new Error('Invalid plugin name');
  const built = fs.existsSync(builtAgentsDir) ? fs.readdirSync(builtAgentsDir, { withFileTypes: true }) : [];
  // Read the complete build before retiring any installed agents.
  const desired = new Map(built.filter(entry => entry.isFile() && entry.name.endsWith('.toml')).map(entry => {
    const source = fs.readFileSync(path.join(builtAgentsDir, entry.name), 'utf8');
    if (!/^[a-z0-9][a-z0-9-]*\.toml$/.test(entry.name) || !/^name = "[^"\r\n]+"\r?\n/.test(source)) throw new Error(`Invalid generated agent: ${entry.name}`);
    const name = `${pluginName}-${entry.name.slice(0, -5)}`;
    return [`${name}.toml`, source.replace(/^name = "[^"\r\n]+"/, `name = "${name}"`)];
  }));
  const previous = new Map();
  function readSnapshot(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) readSnapshot(file);
      else if (entry.isFile() && path.basename(dir) === 'codex-agents' && entry.name.endsWith('.toml')) {
        const copies = previous.get(entry.name) || [];
        copies.push(fs.readFileSync(file));
        previous.set(entry.name, copies);
      }
    }
  }
  readSnapshot(previousSnapshotDir);
  fs.mkdirSync(installedDir, { recursive: true });
  for (const name of fs.readdirSync(installedDir)) {
    const file = path.join(installedDir, name);
    if (!name.endsWith('.toml') || !fs.lstatSync(file).isFile()) continue;
    if (name.startsWith(`${pluginName}-`)) {
      if (!desired.has(name)) fs.unlinkSync(file);
    } else if (previous.has(name) && previous.get(name).some(copy => copy.equals(fs.readFileSync(file)))) {
      fs.unlinkSync(file);
    }
  }
  for (const [name, contents] of desired) fs.writeFileSync(path.join(installedDir, name), contents);
}

module.exports = { sync };
if (require.main === module) {
  if (process.argv.length !== 6) throw new Error('Expected plugin, build, installed, snapshot paths');
  sync(...process.argv.slice(2));
}
