const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = 'ai-driven-dev/framework';

// Keep offsets instead of serializing configuration: only the selected string changes.
function jsonDocument(text) {
  const tokens = [];
  const pattern = /\s+|\/\/[^\r\n]*|\/\*[\s\S]*?\*\/|"(?:\\[^\r\n]|[^"\\\x00-\x1f])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}\[\]:,]/y;
  let offset = 0;
  while (offset < text.length) {
    pattern.lastIndex = offset;
    const match = pattern.exec(text);
    if (!match) throw new Error('Unsupported or invalid JSON configuration.');
    const raw = match[0];
    if (!/^\s|^\/\//.test(raw) && !raw.startsWith('/*')) tokens.push({raw, start:offset, end:pattern.lastIndex});
    offset = pattern.lastIndex;
  }
  let index = 0;
  const strings = new Map();
  const take = raw => {
    if (tokens[index++]?.raw !== raw) throw new Error('Invalid JSON configuration.');
  };
  function value(keys) {
    const token = tokens[index++];
    if (!token) throw new Error('Incomplete JSON configuration.');
    if (token.raw === '{') {
      const object = Object.create(null);
      while (tokens[index]?.raw !== '}') {
        const key = tokens[index++];
        if (!key?.raw.startsWith('"')) throw new Error('Invalid configuration key.');
        const name = JSON.parse(key.raw);
        if (Object.hasOwn(object, name)) throw new Error('Duplicate configuration key; source is ambiguous.');
        take(':');
        object[name] = value([...keys, name]);
        if (tokens[index]?.raw !== ',') break;
        index++;
      }
      take('}');
      return object;
    }
    if (token.raw === '[') {
      const array = [];
      while (tokens[index]?.raw !== ']') {
        array.push(value([...keys, String(array.length)]));
        if (tokens[index]?.raw !== ',') break;
        index++;
      }
      take(']');
      return array;
    }
    const parsed = JSON.parse(token.raw);
    if (typeof parsed === 'string') strings.set(JSON.stringify(keys), token);
    return parsed;
  }
  const data = value([]);
  if (index !== tokens.length) throw new Error('Unexpected data after configuration.');
  return {data, strings};
}

function jsonSource(text) {
  const {data, strings} = jsonDocument(text);
  const source = data?.extraKnownMarketplaces?.['aidd-framework']?.source;
  if (!source) return null;
  if (source.source !== 'github' || source.repo !== REPO || typeof source.ref !== 'string')
    throw new Error('Only a pinned official GitHub marketplace can be updated.');
  const token = strings.get(JSON.stringify(['extraKnownMarketplaces','aidd-framework','source','ref']));
  return {source:{kind:'github', repo:REPO, ref:source.ref}, token};
}

function tomlSource(text) {
  // Accept the ordinary table written by Codex. Complex encodings remain untouched.
  if (text.includes('"""') || text.includes("'''"))
    throw new Error('Multiline TOML requires manual source review.');
  let active = false, tables = 0, offset = 0;
  const values = new Map();
  for (const line of text.split(/(?<=\n)/)) {
    if (/^\s*\[/.test(line)) {
      if (/marketplaces/.test(line) && !/^\s*\[marketplaces\.(?:[\w-]+|"[^"\\]+"|'[^']+')\]\s*(?:#.*)?(?:\r?\n)?$/.test(line))
        throw new Error('Unsupported Codex marketplace table encoding.');
      active = /^\s*\[marketplaces\.(?:aidd-framework|"aidd-framework"|'aidd-framework')\]\s*(?:#.*)?(?:\r?\n)?$/.test(line);
      if (active && ++tables > 1) throw new Error('Duplicate Codex marketplace table.');
    } else if (active && !/^\s*(?:#.*)?$/.test(line)) {
      const match = /^\s*([\w-]+)\s*=\s*("(?:\\.|[^"\\])*"|'[^']*')\s*(?:#.*)?(?:\r?\n)?$/.exec(line);
      if (!match) throw new Error('Unsupported Codex marketplace setting; configuration left unchanged.');
      if (values.has(match[1])) throw new Error('Duplicate Codex marketplace key.');
      const raw = match[2];
      const start = offset + line.indexOf(raw, line.indexOf('='));
      values.set(match[1], {value:raw[0] === '"' ? JSON.parse(raw) : raw.slice(1,-1), start, end:start + raw.length});
    } else if (/^\s*(?:marketplaces|"marketplaces"|'marketplaces')\s*[.=]/.test(line)) {
      throw new Error('Unsupported Codex marketplace table encoding.');
    }
    offset += line.length;
  }
  if (!tables) return null;
  if (values.get('source_type')?.value !== 'git' || values.get('source')?.value !== `https://github.com/${REPO}.git` || !values.has('ref'))
    throw new Error('Only a pinned official Codex Git marketplace can be updated.');
  return {source:{kind:'github',repo:REPO,ref:values.get('ref').value}, token:values.get('ref')};
}

function configPaths(tool, {cwd = process.cwd(), env = process.env, home = os.homedir()} = {}) {
  if (tool === 'codex') return [{path:path.join(env.CODEX_HOME || path.join(home,'.codex'),'config.toml'),scope:'user'}];
  if (tool === 'copilot') return [{path:path.join(env.COPILOT_HOME || path.join(home,'.copilot'),'settings.json'),scope:'user'}];
  if (tool === 'claude') return [
    {path:path.join(env.CLAUDE_CONFIG_DIR || path.join(home,'.claude'),'settings.json'),scope:'user'},
    {path:path.join(cwd,'.claude','settings.json'),scope:'project'},
    {path:path.join(cwd,'.claude','settings.local.json'),scope:'local'},
  ];
  throw new Error('Unsupported native tool.');
}

function listNativeConfigs(tool, options = {}) {
  const result = [];
  for (const entry of configPaths(tool, options)) {
    let text;
    try { text = fs.readFileSync(entry.path, 'utf8'); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    const parsed = tool === 'codex' ? tomlSource(text) : jsonSource(text);
    if (!parsed) continue;
    result.push({...entry, text, source:parsed.source, replaceRef:ref => {
      if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(ref)) throw new Error('A root release tag is required.');
      return text.slice(0,parsed.token.start) + JSON.stringify(ref) + text.slice(parsed.token.end);
    }});
  }
  return result;
}

function readNativeConfig(tool, options = {}) {
  const configs = listNativeConfigs(tool, options);
  if (configs.length !== 1 || (options.scope && configs[0].scope !== options.scope))
    throw new Error('A single effective, editable native marketplace source is required.');
  if (tool === 'claude' && configs[0].scope === 'local') throw new Error('Local Claude marketplace settings are not supported.');
  return configs[0];
}

// Reinstalling through Codex enables the plugin. Locate only its explicit user flag.
function codexActivation(text, ref) {
  if (text.includes('"""') || text.includes("'''")) throw new Error('Multiline TOML requires manual activation review.');
  let active = false, tables = 0, offset = 0, token;
  for (const line of text.split(/(?<=\n)/)) {
    if (/^\s*\[/.test(line)) {
      const table = /^\s*\[plugins\.(?:"([^"\\]+)"|'([^']+)')\]\s*(?:#.*)?(?:\r?\n)?$/.exec(line);
      if (/^\s*\[(?:plugins|"plugins"|'plugins')(?:\.|\])/.test(line) && !table)
        throw new Error('Unsupported Codex plugin table; activation cannot be preserved.');
      active = (table?.[1] || table?.[2]) === ref;
      if (active && ++tables > 1) throw new Error('Duplicate Codex plugin table.');
    } else if (active && !/^\s*(?:#.*)?$/.test(line)) {
      const match = /^(\s*enabled\s*=\s*)(true|false)\s*(?:#.*)?(?:\r?\n)?$/.exec(line);
      if (!match || token) throw new Error('Unsupported Codex plugin activation.');
      token = {start:offset + match[1].length,end:offset + match[1].length + match[2].length,enabled:match[2] === 'true'};
    } else if (/^\s*(?:plugins|"plugins"|'plugins')\s*[.=]/.test(line)) {
      throw new Error('Unsupported Codex plugin table; activation cannot be preserved.');
    }
    offset += line.length;
  }
  if (!token) throw new Error('An explicit Codex plugin activation is required for repair.');
  return {enabled:token.enabled,replaceEnabled:enabled => text.slice(0,token.start) + String(enabled) + text.slice(token.end)};
}

module.exports = {listNativeConfigs, readNativeConfig, codexActivation};
