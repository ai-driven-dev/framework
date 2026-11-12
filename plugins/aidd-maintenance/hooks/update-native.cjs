#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFile} = require('node:child_process');
const {inspectInventory} = require('./lib/inventory.cjs');
const {readNativeConfig} = require('./lib/native-config.cjs');
const {releaseTag, semver, compare} = require('./lib/versions.cjs');
const {releaseTitle} = require('./lib/releases.cjs');

const REPO = 'ai-driven-dev/framework';
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const identity = entry => `${entry.ref}:${entry.scope}:${entry.projectPath || ''}`;

async function readRelease(tag, fetcher, env) {
  if (!releaseTag(tag)) throw new Error('A root release tag is required.');
  const token = env.GH_TOKEN || env.GITHUB_TOKEN || env.AIDD_TOKEN;
  const get = async url => {
    const response = await fetcher(url, {
      headers: token && url.startsWith('https://api.github.com/') ? {Authorization:`Bearer ${token}`} : {},
      signal:AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Official release lookup failed (${response.status}).`);
    return response.json();
  };
  const root = `https://api.github.com/repos/${REPO}`;
  const release = await get(`${root}/releases/tags/${encodeURIComponent(tag)}`);
  if (release.tag_name !== tag || release.draft !== false) throw new Error('The selected release is not published.');
  const {sha} = await get(`${root}/commits/${encodeURIComponent(tag)}`);
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('The release commit could not be verified.');
  const versions = await get(`https://raw.githubusercontent.com/${REPO}/${sha}/.release-please-manifest.json`);
  if (!semver(versions['.']) || compare(semver(versions['.']), releaseTag(tag)) !== 0)
    throw new Error('The release manifest does not match the selected tag.');
  let title = typeof release.name === 'string' ? release.name : tag;
  try { title = await releaseTitle(fetcher, REPO, tag) || title; } catch { /* The tag and versions remain verified. */ }
  return {tag, sha, title, versions};
}

async function prepare(options) {
  const {tool, scope, release, cwd, home, env, fetcher, inspect} = options;
  if (!['claude','codex','copilot'].includes(tool) || !['project','user'].includes(scope))
    throw new Error('Choose a supported native tool and project or user scope.');
  if (tool !== 'claude' && scope !== 'user') throw new Error('This native host updates its user marketplace.');
  const config = readNativeConfig(tool, {cwd,env,home});
  if (!releaseTag(config.source.ref) || !releaseTag(release) || compare(releaseTag(release),releaseTag(config.source.ref)) < 0)
    throw new Error('The selected release must not precede the pinned source.');
  const inventory = await inspect({cwd,home,env,tool});
  const warnings = inventory.warnings?.filter(warning => warning.tool === tool) || [];
  const recovering = config.source.ref === release && warnings.length > 0 &&
    warnings.every(warning => warning.code === 'native-catalogue-source-mismatch');
  if (warnings.length && !recovering)
    throw new Error('Native inventory is incomplete; no update prepared.');
  const impact = inventory.installations.filter(entry => entry.manager === 'native' && entry.tool === tool && entry.ref?.endsWith('@aidd-framework'));
  if (!impact.length) throw new Error('No installed native AIDD plugins could be verified.');
  for (const entry of impact) {
    if (entry.managed || entry.restricted || typeof entry.enabled !== 'boolean' ||
        entry.source?.kind !== 'github' || entry.source.repo !== REPO ||
        (entry.source.ref !== config.source.ref && !(recovering && entry.source.ref === null)))
      throw new Error('Native source, enabled state or policy is unverified; no update prepared.');
  }
  const targets = impact.filter(entry => scope === 'user' ? entry.scope === 'user' :
    ['project','local'].includes(entry.scope) && entry.projectPath === fs.realpathSync(cwd));
  if (!targets.length) throw new Error('No installed native AIDD plugins in the selected scope.');
  const selected = await readRelease(release,fetcher,env);
  const updates = targets.map(entry => {
    const targetVersion = selected.versions[`plugins/${entry.name}`];
    if (!semver(targetVersion) || !semver(entry.version) || compare(semver(targetVersion),semver(entry.version)) < 0)
      throw new Error(`The target version of ${entry.name} cannot be safely updated.`);
    return {...entry,targetVersion};
  });
  const preview = {
    tool, scope, currentRelease:config.source.ref, release, commit:selected.sha, title:selected.title,
    releaseNotes:`https://github.com/${REPO}/releases/tag/${release}`,
    comparison:`https://github.com/${REPO}/compare/${config.source.ref}...${release}`,
    sourceConfig:config.path, sourceScope:config.scope, impact, updates,
    ...(recovering ? {recovery:'The selected ref is configured but its native catalogue has not refreshed.'} : {}),
  };
  const approval = digest(JSON.stringify({...preview,title:undefined,configHash:digest(config.text)}));
  return {config,preview:{...preview,approval}};
}

function runNative(tool,args,{cwd,env}) {
  return new Promise((resolve,reject) => execFile(tool,args,{cwd,env,timeout:120000,maxBuffer:4*1024*1024},error => {
    if (error) reject(new Error(`${tool} ${args.slice(0,3).join(' ')} failed (${typeof error.code === 'string' || typeof error.code === 'number' ? error.code : 'unknown'}).`));
    else resolve();
  }));
}

async function updateNative(input) {
  const options = {cwd:process.cwd(),home:os.homedir(),env:process.env,fetcher:fetch,inspect:inspectInventory,run:runNative,...input};
  const {config,preview} = await prepare(options);
  if (!options.approve) return {status:'preview',...preview};
  if (options.approve !== preview.approval) throw new Error('The preview changed; review its new impact before approving.');
  const lockPath = `${config.path}.aidd-update.lock`;
  if (fs.realpathSync(config.path) !== path.resolve(config.path)) throw new Error('A symbolic-link configuration cannot be updated.');
  const lock = fs.openSync(lockPath,'wx',0o600);
  const temporary = `${config.path}.aidd-${crypto.randomUUID()}.tmp`;
  let changed = false;
  try {
    const current = await options.inspect({cwd:options.cwd,home:options.home,env:options.env,tool:options.tool});
    const impact = current.installations.filter(entry => entry.manager === 'native' && entry.tool === options.tool && entry.ref?.endsWith('@aidd-framework'));
    if (JSON.stringify(impact) !== JSON.stringify(preview.impact) || current.warnings?.some(warning =>
      warning.tool === options.tool && !(preview.recovery && warning.code === 'native-catalogue-source-mismatch')))
      throw new Error('Native installations changed after the preview.');
    if (fs.readFileSync(config.path,'utf8') !== config.text) throw new Error('Native configuration changed after the preview.');
    const mode = fs.statSync(config.path).mode & 0o777;
    const file = fs.openSync(temporary,'wx',mode);
    try {
      fs.writeFileSync(file,config.replaceRef(options.release));
      fs.fchmodSync(file,mode);
    } finally { fs.closeSync(file); }
    if (fs.realpathSync(config.path) !== path.resolve(config.path) || fs.readFileSync(config.path,'utf8') !== config.text)
      throw new Error('Native configuration changed before writing.');
    fs.renameSync(temporary,config.path);
    changed = true;
    const {tool,cwd,env,run} = options;
    const args = tool === 'codex' ? ['plugin','marketplace','upgrade','aidd-framework','--json'] :
      tool === 'claude' ? ['plugin','marketplace','add',`${REPO}#${options.release}`,'--scope',config.scope] :
        ['plugin','marketplace','update','aidd-framework'];
    await run(tool,args,{cwd,env});
    if (tool !== 'codex') for (const target of preview.updates) {
      const args = ['plugin','update',target.ref];
      if (tool === 'claude') args.push('--scope',target.scope);
      await run(tool,args,{cwd,env});
    }
    const after = await options.inspect({cwd,env,home:options.home,tool});
    for (const before of preview.impact) {
      const installed = after.installations.find(entry => entry.manager === 'native' && entry.tool === tool && identity(entry) === identity(before));
      const target = preview.updates.find(entry => identity(entry) === identity(before));
      if (!installed || installed.enabled !== before.enabled || installed.version !== (target?.targetVersion ?? before.version) ||
          installed.source?.ref !== options.release)
        throw new Error(`Installed state of ${before.ref} could not be verified.`);
    }
    if (readNativeConfig(tool,{cwd,env,home:options.home}).source.ref !== options.release)
      throw new Error('The configured source changed during the update.');
    return {status:'updated',...preview,restartRequired:true};
  } catch (error) {
    if (changed) throw new Error(`Native update incomplete after setting ${options.release}. Inspect the source and installed plugins before retrying. ${error.message}`);
    throw error;
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    fs.closeSync(lock); fs.unlinkSync(lockPath);
  }
}

if (require.main === module) {
  const options = {};
  try {
    for (let i=2;i<process.argv.length;i+=2) {
      const key = process.argv[i].replace(/^--/,'');
      if (!['tool','scope','release','approve'].includes(key) || !process.argv[i+1]) throw new Error('Usage: update-native.cjs --tool <tool> --scope <project|user> --release <tag> [--approve <preview approval>]');
      options[key] = process.argv[i+1];
    }
    updateNative(options).then(result => console.log(JSON.stringify(result,null,2))).catch(error => {console.error(error.message);process.exitCode=1;});
  } catch (error) {console.error(error.message);process.exitCode=1;}
}

module.exports = {updateNative};
