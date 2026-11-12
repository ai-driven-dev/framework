'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { semver, releaseTag, compare } = require('./versions.cjs');

const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function json(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function realPath(file) {
  try { return fs.realpathSync(file); } catch { return path.resolve(file); }
}

function configDir(env, home) {
  return env.AIDD_USER_CONFIG_DIR || path.join(env.XDG_CONFIG_HOME || path.join(home, '.config'), 'aidd');
}

function projectFile(cwd, name) {
  let dir = path.resolve(cwd);
  while (true) {
    const file = path.join(dir, '.aidd', name);
    if (fs.existsSync(file)) return file;
    if (fs.existsSync(path.join(dir, '.git'))) return null;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function nativeClaudeCatalogue(env, home) {
  const claudePlugins = path.join(env.CLAUDE_CONFIG_DIR || path.join(home, '.claude'), 'plugins');
  const resolveReal = value => { try { return fs.realpathSync(value); } catch { return path.resolve(value); } };
  const claudeCache = resolveReal(path.join(claudePlugins, 'cache', 'aidd-framework'));
  const pluginRoot = env.CLAUDE_PLUGIN_ROOT && resolveReal(env.CLAUDE_PLUGIN_ROOT);
  if (!pluginRoot) return null;
  const native = json(path.join(claudePlugins, 'known_marketplaces.json'))?.['aidd-framework'];
  if (!native || typeof native.installLocation !== 'string') return null;
  const manifest = json(path.join(native.installLocation, '.claude-plugin', 'marketplace.json'));
  if (!manifest || manifest.name !== 'aidd-framework') return null;
  const marketplaceRoot = resolveReal(native.installLocation);
  const pluginSource = Array.isArray(manifest.plugins)
    ? manifest.plugins.find(plugin => plugin?.name === 'aidd-maintenance')?.source : null;
  const directRoot = typeof pluginSource === 'string' && !path.isAbsolute(pluginSource)
    ? resolveReal(path.join(marketplaceRoot, pluginSource)) : null;
  const direct = directRoot && directRoot.startsWith(`${marketplaceRoot}${path.sep}`) && pluginRoot === directRoot;
  if (!pluginRoot.startsWith(`${claudeCache}${path.sep}`) && !direct) return null;
  const source = native.source?.source === 'github'
    ? { kind: 'github', repo: native.source.repo, ref: native.source.ref }
    : { kind: 'local' };
  return { version: manifest.version, source, scope:'native' };
}

function cliCatalogue(cwd, env, home) {
  for (const {file, scope} of [
    {file:projectFile(cwd, 'marketplaces.json'), scope:'project'},
    {file:path.join(configDir(env, home), 'marketplaces.json'), scope:'user'},
  ]) {
    if (!file || !fs.existsSync(file)) continue;
    const registry = json(file);
    if (!registry || !Array.isArray(registry.marketplaces)) return null;
    const entry = registry.marketplaces.find(item => item.name === 'aidd-framework');
    if (entry) return { version: entry.version, source: entry.source, scope };
  }
  return null;
}

// The CLI records the project and machine installations in separate manifests. A project can
// reference a user-scoped plugin, but only the machine manifest owns that plugin's version.
function plugins(cwd, env, home, current) {
  const manifests = [
    { file: projectFile(cwd, 'manifest.json'), scope: 'project' },
    { file: path.join(configDir(env, home), 'manifest.json'), scope: 'user' },
  ];
  const found = []; const installations = []; let unverified = false; let globalUnverified = false; let hasManifest = false; let machineCount = 0;
  const userReferences = new Set(); const machinePlugins = new Set();
  const userRegistry = json(path.join(configDir(env, home), 'marketplaces.json'));
  const userEntry = Array.isArray(userRegistry?.marketplaces)
    ? userRegistry.marketplaces.find(entry => entry?.name === 'aidd-framework') : null;
  const userRef = releaseTag(userEntry?.source?.ref);
  const userVersion = semver(userEntry?.version);
  const projectRef = releaseTag(current?.source?.ref);
  const projectVersion = semver(current?.version);
  const projectComparable = current?.source?.kind === 'github' && REPO.test(current.source.repo || '') &&
    projectRef && projectVersion && compare(projectRef, projectVersion) === 0;
  const userComparable = userEntry?.source?.kind === 'github' && REPO.test(userEntry.source.repo || '') &&
    userRef && userVersion && compare(userRef, userVersion) === 0;
  for (const {file, scope} of manifests) {
    if (!file || !fs.existsSync(file)) continue;
    hasManifest = true;
    const markUnverified = () => { if (scope === 'user') globalUnverified = true; else unverified = true; };
    const data = json(file);
    if (data?.version !== 8 || !data.tools || typeof data.tools !== 'object' || Array.isArray(data.tools)) {
      markUnverified();
      continue;
    }
    for (const [tool, entry] of Object.entries(data.tools)) {
      if (!/^[a-z0-9-]+$/.test(tool) || !entry || typeof entry !== 'object' || Array.isArray(entry)) { markUnverified(); continue; }
      if (entry.plugins === undefined) continue;
      if (!Array.isArray(entry.plugins)) { markUnverified(); continue; }
      for (const plugin of entry.plugins) {
        if (!plugin || typeof plugin !== 'object' || Array.isArray(plugin)) { markUnverified(); continue; }
        if (plugin.marketplace !== 'aidd-framework') {
          const repo = scope === 'user' ? userEntry?.source?.repo : current?.source?.repo;
          if (plugin.marketplace === undefined && repo && plugin.source?.kind === 'git-subdir' &&
              plugin.source.url === `https://github.com/${repo}.git` &&
              plugin.source.path === `plugins/${plugin.name}`) markUnverified();
          continue;
        }
        if (scope === 'project' && plugin.scope === 'user') { userReferences.add(`${tool}:${plugin.name}`); continue; }
        if (plugin.scope !== scope || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(plugin.name || '')) {
          markUnverified(); continue;
        }
        installations.push({manager:'aidd',tool,scope,name:plugin.name,ref:`${plugin.name}@aidd-framework`,
          version:semver(plugin.version) ? plugin.version : null,source:pluginSource(plugin.source, plugin.name)});
        if (scope === 'user') { machinePlugins.add(`${tool}:${plugin.name}`); machineCount++; }
        if (scope === 'user' && !userComparable) { globalUnverified = true; continue; }
        if (scope === 'project' && !projectComparable) {
          if (current?.source?.kind !== 'local') unverified = true;
          continue;
        }
        const repo = scope === 'user' ? userEntry.source.repo : current.source.repo;
        const source = plugin.source;
        const version = semver(plugin.version);
        const ref = releaseTag(source?.ref);
        if (source?.kind !== 'git-subdir' || source.url !== `https://github.com/${repo}.git` || source.path !== `plugins/${plugin.name}` || !version || !ref) {
          markUnverified();
          continue;
        }
        const channel = ref.prerelease[0] || '';
        found.push({manager:'aidd',tool, name:plugin.name, scope, version:plugin.version, ref:source.ref, repo, channel});
      }
    }
  }
  if ([...userReferences].some(reference => !machinePlugins.has(reference))) globalUnverified = true;
  return { found, installations, unverified: unverified || !hasManifest, globalUnverified, machineCount, hasManifest };
}

function githubSource(url, ref) {
  if (typeof url !== 'string') return {kind:'unknown'};
  const match = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/.exec(url);
  return match ? {kind:'github',repo:match[1],ref:typeof ref === 'string' ? ref : null} : {kind:'unknown'};
}

function safeSource(source) {
  if (source?.kind === 'github' && REPO.test(source.repo || ''))
    return {kind:'github',repo:source.repo,ref:typeof source.ref === 'string' ? source.ref : null};
  if (source?.kind === 'local') return {kind:'local',...(typeof source.path === 'string' ? {path:source.path} : {})};
  return {kind:'unknown'};
}

function pluginSource(source, name) {
  if (source?.kind === 'git-subdir' && source.path === `plugins/${name}`) return githubSource(source.url, source.ref);
  return safeSource(source);
}

/** Host output is consumed as data; never forward stderr, which may contain credentials. */
function runNative(tool, args, {cwd,env,home}) {
  return new Promise((resolve,reject) => {
    execFile(tool,args,{cwd,env:{...env,HOME:home},encoding:'utf8',timeout:2500,maxBuffer:2*1024*1024},(error,stdout) => {
      if (error) return reject(new Error('Native inventory unavailable'));
      try { resolve(JSON.parse(stdout)); } catch { reject(new Error('Native inventory unreadable')); }
    });
  });
}

function nativeHome(tool, env, home) {
  return env[{claude:'CLAUDE_CONFIG_DIR',codex:'CODEX_HOME',copilot:'COPILOT_HOME'}[tool]] || path.join(home,`.${tool}`);
}

function configured(tool,env,home) {
  const dir=nativeHome(tool,env,home);
  return fs.existsSync(path.join(dir,tool === 'codex' ? 'config.toml' : 'settings.json')) ||
    (tool === 'claude' && fs.existsSync(path.join(dir,'plugins','known_marketplaces.json')));
}

function marketplaceRow(tool, data) {
  const rows=tool === 'codex' ? data?.marketplaces : data;
  if (!Array.isArray(rows)) throw new Error('Native marketplace shape is unverified');
  const matches=rows.filter(row=>row?.name === 'aidd-framework');
  if (matches.length > 1) throw new Error('Native marketplace is ambiguous');
  return matches[0];
}

function nativeSource(tool,row) {
  if (tool === 'codex') {
    const source=row.marketplaceSource;
    return source?.sourceType === 'local' && typeof source.source === 'string'
      ? {kind:'local',path:source.source} : source?.sourceType === 'git' ? githubSource(source.source) : {kind:'unknown'};
  }
  if (tool === 'claude') {
    if (row.source === 'github' && REPO.test(row.repo || '')) return {kind:'github',repo:row.repo,ref:null};
    return row.source === 'directory' && typeof row.path === 'string' ? {kind:'local',path:row.path} : {kind:'unknown'};
  }
  if (typeof row.source !== 'string') return {kind:'unknown'};
  if (row.source.startsWith('Local: ')) return {kind:'local',path:row.source.slice(7)};
  const repo=/^GitHub: ([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)$/.exec(row.source)?.[1];
  return repo ? {kind:'github',repo,ref:null} : {kind:'unknown'};
}

function readSourceConfig(tool,options) {
  return require('./native-config.cjs').readNativeConfig(tool,options);
}

/** CLI listing establishes the effective source; the editable config supplies only its ref. */
async function inspectNative(tool, options) {
  const {runner,sourceReader,cwd,env,home}=options;
  if (runner === runNative && !configured(tool,env,home)) return {catalogues:[],installations:[],warnings:[]};
  try {
    const [marketplaces,listed]=await Promise.all([
      runner(tool,['plugin','marketplace','list','--json'],options),
      runner(tool,['plugin','list',...(tool === 'codex' ? ['--marketplace','aidd-framework'] : []),'--json'],options),
    ]);
    const row=marketplaceRow(tool,marketplaces);
    if (!row) return {catalogues:[],installations:[],warnings:[]};
    let source=nativeSource(tool,row); let sourceConfig; let sourceScope='unknown'; const warnings=[];
    if (source.kind === 'github') {
      try {
        const config=sourceReader(tool,{cwd,env,home});
        if (config.source.kind !== 'github' || config.source.repo !== source.repo) throw new Error('Source mismatch');
        source=safeSource(config.source); sourceConfig=config.path; sourceScope=config.scope;
      } catch { warnings.push({tool,code:'native-source-unverified'}); }
    }
    const root=tool === 'codex' ? row.root : tool === 'claude' ? row.installLocation : source.path;
    const manifest=typeof root === 'string' ? json(path.join(root,'.claude-plugin','marketplace.json')) : null;
    const version=manifest?.name === 'aidd-framework' && semver(manifest.version) ? manifest.version : null;
    if (source.kind === 'github' && releaseTag(source.ref) && version && compare(releaseTag(source.ref),semver(version)) !== 0) {
      source={...source,ref:null};
      warnings.push({tool,code:'native-catalogue-source-mismatch'});
    }
    const catalogue={manager:'native',tool,scope:sourceScope,version,source,...(sourceConfig ? {sourceConfig} : {})};
    const rows=tool === 'codex' ? listed?.installed : listed;
    if (!Array.isArray(rows)) throw new Error('Native plugins shape is unverified');
    const installations=[];
    for (const item of rows) {
      const ref=tool === 'claude' ? item?.id : tool === 'codex' ? item?.pluginId : `${item?.name}@${item?.marketplace}`;
      if (typeof ref !== 'string' || !ref.endsWith('@aidd-framework')) continue;
      const name=ref.slice(0,-'@aidd-framework'.length);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw new Error('Native plugin identity is unverified');
      const scope=tool === 'claude' ? item.scope : 'user';
      if (!['user','project','local'].includes(scope)) throw new Error('Native plugin scope is unverified');
      const projectPath=typeof item.projectPath === 'string' ? realPath(item.projectPath) : undefined;
      installations.push({manager:'native',tool,scope,name,ref,version:semver(item.version) ? item.version : null,
        enabled:typeof item.enabled === 'boolean' ? item.enabled : null,source,
        currentProject:scope === 'user' || projectPath === realPath(cwd),
        ...([item.managed,row.managed].some(value=>typeof value === 'boolean')
          ? {managed:item.managed === true || row.managed === true} : {}),
        ...([item.restricted,row.restricted].some(value=>typeof value === 'boolean')
          ? {restricted:item.restricted === true || row.restricted === true} : {}),
        ...(item.installPolicy === 'NOT_AVAILABLE' ? {restricted:true} : {}),
        ...(sourceConfig ? {sourceConfig} : {}),...(projectPath ? {projectPath} : {})});
    }
    return {catalogues:[catalogue],installations,warnings};
  } catch { return {catalogues:[],installations:[],warnings:[{tool,code:'native-unavailable'}]}; }
}

async function inspectInventory({cwd=process.cwd(),env=process.env,home=os.homedir(),tool,scope,allNative=false,
  runner=runNative,sourceReader=readSourceConfig}={}) {
  const current=cliCatalogue(cwd,env,home);
  const managed=plugins(cwd,env,home,current);
  const catalogues=[];
  if (current) catalogues.push({manager:'aidd',...current,version:semver(current.version) ? current.version : null,source:safeSource(current.source)});
  const user=json(path.join(configDir(env,home),'marketplaces.json'))?.marketplaces?.find?.(entry=>entry?.name === 'aidd-framework');
  if (user && current?.scope !== 'user') catalogues.push({manager:'aidd',scope:'user',version:semver(user.version) ? user.version : null,source:safeSource(user.source)});
  const nativeTools=allNative ? ['claude','codex','copilot'] : ['claude','codex','copilot'].includes(tool) ? [tool] : [];
  const native=await Promise.all(nativeTools.map(host=>inspectNative(host,{cwd,env,home,runner,sourceReader})));
  const installations=[...managed.installations,...native.flatMap(entry=>entry.installations)];
  catalogues.push(...native.flatMap(entry=>entry.catalogues));
  const legacy=(!tool || tool === 'claude') ? nativeClaudeCatalogue(env,home) : null;
  const nativeOwnsSelection=nativeTools.includes(tool) && configured(tool,env,home);
  const selected=catalogues.find(entry=>entry.manager === 'native' && entry.tool === tool) ||
    (legacy ? {manager:'native',tool:'claude',...legacy} : current && !nativeOwnsSelection ? {manager:'aidd',...current} : null);
  const warnings=native.flatMap(entry=>entry.warnings);
  const order=entry=>`${entry.manager}:${entry.tool || ''}:${entry.scope}:${entry.name || ''}:${entry.projectPath || ''}`;
  const sorted=entries=>entries.sort((a,b)=>order(a)<order(b) ? -1 : order(a)>order(b) ? 1 : 0);
  return {catalogues:sorted(catalogues),installations:sorted(installations.filter(entry=>(!scope || entry.scope === scope) && (!tool || entry.tool === tool))),warnings,
    current:selected ? {...selected,source:safeSource(selected.source)} : null,managed};
}

module.exports={json,configDir,inspectInventory,runNative};
