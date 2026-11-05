#!/usr/bin/env node
// A catalogue version is not a claim about the individual plugins the host loaded.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const OFFICIAL_REPO = 'ai-driven-dev/framework';

function json(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
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

function catalogue(cwd, env, home, tool) {
  // The host's installed plugin owns its native catalogue, even when an unrelated CLI
  // installation registered another source in the same project or machine.
  if (!tool || tool === 'claude') {
    const native = nativeClaudeCatalogue(env, home);
    if (native) return native;
  }
  return cliCatalogue(cwd, env, home);
}

function semver(value) {
  if (typeof value !== 'string') return null;
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(value);
  if (!match) return null;
  return { numbers: match.slice(1, 4).map(Number), prerelease: match[4]?.split('.') ?? [] };
}

function releaseTag(value) {
  return typeof value === 'string' && value.startsWith('v') ? semver(value) : null;
}

// The CLI records the project and machine installations in separate manifests. A project can
// reference a user-scoped plugin, but only the machine manifest owns that plugin's version.
function plugins(cwd, env, home, current) {
  const manifests = [
    { file: projectFile(cwd, 'manifest.json'), scope: 'project' },
    { file: path.join(configDir(env, home), 'manifest.json'), scope: 'user' },
  ];
  const found = []; let unverified = false; let globalUnverified = false; let hasManifest = false; let machineCount = 0;
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
    const data = json(file);
    if (data?.version !== 8 || !data.tools || typeof data.tools !== 'object' || Array.isArray(data.tools)) {
      if (scope === 'user') globalUnverified = true; else unverified = true;
      continue;
    }
    for (const [tool, entry] of Object.entries(data.tools)) {
      if (!/^[a-z0-9-]+$/.test(tool) || !entry || typeof entry !== 'object') { unverified = true; continue; }
      if (entry.plugins === undefined) continue;
      if (!Array.isArray(entry.plugins)) { unverified = true; continue; }
      for (const plugin of entry.plugins) {
        if (!plugin) continue;
        if (plugin.marketplace !== 'aidd-framework') {
          const repo = scope === 'user' ? userEntry?.source?.repo : current?.source?.repo;
          if (plugin.marketplace === undefined && repo && plugin.source?.kind === 'git-subdir' &&
              plugin.source.url === `https://github.com/${repo}.git` &&
              plugin.source.path === `plugins/${plugin.name}`) unverified = true;
          continue;
        }
        if (scope === 'project' && plugin.scope === 'user') { userReferences.add(`${tool}:${plugin.name}`); continue; }
        if (plugin.scope !== scope || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(plugin.name || '')) {
          unverified = true; continue;
        }
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
          if (scope === 'user') globalUnverified = true; else unverified = true;
          continue;
        }
        const channel = ref.prerelease[0] || '';
        found.push({tool, name:plugin.name, scope, version:plugin.version, ref:source.ref, repo, channel});
      }
    }
  }
  if ([...userReferences].some(reference => !machinePlugins.has(reference))) globalUnverified = true;
  return { found, unverified: unverified || !hasManifest, globalUnverified, machineCount, hasManifest };
}

function compare(left, right) {
  for (let i = 0; i < 3; i++) {
    if (left.numbers[i] !== right.numbers[i]) return left.numbers[i] - right.numbers[i];
  }
  if (!left.prerelease.length) return right.prerelease.length ? 1 : 0;
  if (!right.prerelease.length) return -1;
  for (let i = 0; i < Math.max(left.prerelease.length, right.prerelease.length); i++) {
    const a = left.prerelease[i]; const b = right.prerelease[i];
    if (a === undefined) return -1;
    if (b === undefined) return 1;
    if (a === b) continue;
    const an = /^\d+$/.test(a); const bn = /^\d+$/.test(b);
    if (an && bn) return Number(a) - Number(b);
    if (an !== bn) return an ? -1 : 1;
    return a < b ? -1 : 1;
  }
  return 0;
}

function clean(value) {
  return typeof value === 'string' ? value.replace(/[\x00-\x1f\x7f]+/g, ' ').trim().slice(0, 180) : '';
}

async function request(fetcher, url, signal) {
  const response = await fetcher(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'aidd-maintenance' }, signal });
  if (!response.ok) throw new Error('Release unavailable');
  return response.json();
}

async function releaseTitle(fetcher, repo, tag) {
  const encodedRepo = repo.split('/').map(encodeURIComponent).join('/');
  const video = await request(fetcher, `https://github.com/${encodedRepo}/releases/download/${encodeURIComponent(tag)}/release-video.json`, AbortSignal.timeout(1500));
  const title = clean(video.title);
  if (!title) throw new Error('Release title unavailable');
  return title;
}

async function latestRelease(fetcher, repo, channel) {
  const encodedRepo = repo.split('/').map(encodeURIComponent).join('/');
  const signal = AbortSignal.timeout(3000);
  let selected;
  // Component releases can hide the marketplace release; keep walking while a page is full.
  for (let page = 1; page <= 5; page++) {
    const releases = await request(fetcher, `https://api.github.com/repos/${encodedRepo}/releases?per_page=100&page=${page}`, signal);
    if (!Array.isArray(releases)) throw new Error('Invalid releases');
    for (const release of releases) {
      const parsed = releaseTag(release.tag_name);
      if (!parsed || release.draft) continue;
      const releaseChannel = parsed.prerelease[0] || '';
      if (releaseChannel !== channel || (!channel && release.prerelease)) continue;
      if (!selected || compare(parsed, selected.parsed) > 0) selected = { release, parsed };
    }
    if (releases.length < 100) break;
  }
  if (!selected) throw new Error('No matching marketplace release');
  const release = selected.release;
  let title = clean(release.name) || release.tag_name;
  let titlePending = false;
  if (Array.isArray(release.assets) && release.assets.some(asset => asset.name === 'release-video.json')) {
    try {
      title = await releaseTitle(fetcher, repo, release.tag_name);
    } catch { titlePending = true; }
  }
  return { tag: release.tag_name, title, titlePending };
}

// Release Please records all plugin versions in one file at the root release tag. It is useful
// only when its root version agrees with that tag; otherwise the target versions are unknown.
async function releasePluginVersions(fetcher, repo, tag) {
  if (repo !== OFFICIAL_REPO) return null;
  try {
    const url = `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(tag)}/.release-please-manifest.json`;
    const data = await request(fetcher, url, AbortSignal.timeout(1500));
    if (!data || !semver(data['.']) || compare(semver(data['.']), releaseTag(tag)) !== 0) return null;
    const versions = {};
    for (const [key, value] of Object.entries(data)) {
      if (/^plugins\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key) && semver(value)) versions[key.slice(8)] = value;
    }
    return versions;
  } catch { return null; }
}

function cacheFile(env, home, repo, channel) {
  const key = crypto.createHash('sha256').update(`${repo}:${channel}`).digest('hex').slice(0, 16);
  return path.join(configDir(env, home), 'cache', `maintenance-${key}.json`);
}

function saveCache(file, data) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(data));
    fs.renameSync(temporary, file);
  } catch { /* Cache failures never stop a conversation. */ }
}

async function releaseState(env, home, now, fetcher, repo, channel) {
  const file = cacheFile(env, home, repo, channel);
  const cached = json(file);
  let latest = null;
  let checkedAt = now; let save = false;
  if (cached && Number.isFinite(cached.checkedAt) && now >= cached.checkedAt && now - cached.checkedAt < DAY && releaseTag(cached.latest?.tag)) {
    latest = cached.latest;
    checkedAt = cached.checkedAt;
  } else {
    try {
      latest = await latestRelease(fetcher, repo, channel);
      save = true;
    } catch { /* The release remains unknown until the next attempt. */ }
  }
  if (latest) {
    if (latest.titlePending === undefined && repo === OFFICIAL_REPO && latest.title === latest.tag) {
      latest.titlePending = true;
      latest.titleCheckedAt = checkedAt;
      save = true;
    }
    if (latest.titlePending) {
      if (save) latest.titleCheckedAt = now;
      else if (!Number.isFinite(latest.titleCheckedAt) || now < latest.titleCheckedAt || now - latest.titleCheckedAt >= HOUR) {
        try {
          latest.title = await releaseTitle(fetcher, repo, latest.tag);
          latest.titlePending = false;
        } catch { /* Retry the title later without hiding the known release. */ }
        latest.titleCheckedAt = now;
        save = true;
      }
    }
  }
  return { file, latest, checkedAt, save };
}

async function status({ cwd = process.cwd(), env = process.env, home = os.homedir(), now = Date.now(), fetcher = fetch, tool } = {}) {
  const current = catalogue(cwd, env, home, tool);
  const version = semver(current?.version);
  const source = current?.source;
  const result = { version: version ? current.version.replace(/^v/, '') : null, latest: null, unavailable: false };
  const local = source?.kind === 'local';
  const pinned = releaseTag(source?.ref);
  const comparable = version && source?.kind === 'github' && REPO.test(source.repo || '') && pinned && compare(pinned, version) === 0;
  if (!local && !comparable) {
    if (source?.kind !== 'github' || !REPO.test(source.repo || '')) result.comparisonUnavailable = 'Source du marketplace inconnue : comparaison indisponible';
    else if (!version) result.comparisonUnavailable = 'Version du marketplace inconnue : comparaison indisponible';
    else if (!pinned) result.comparisonUnavailable = 'Source non épinglée à une release : comparaison indisponible';
    else result.comparisonUnavailable = 'Version du marketplace incohérente avec sa source : comparaison indisponible';
  }
  const states = new Map();
  const stateFor = (repo, channel) => {
    const key = `${repo}:${channel}`;
    if (!states.has(key)) states.set(key, releaseState(env, home, now, fetcher, repo, channel));
    return states.get(key);
  };
  const currentState = local || comparable
    ? stateFor(local ? OFFICIAL_REPO : source.repo, version?.prerelease[0] || '') : null;
  result.local = local;
  // A native Claude catalogue and the CLI's project/global registrations can be distinct.
  const cliCurrent = cliCatalogue(cwd, env, home);
  const installed = plugins(cwd, env, home, cliCurrent);
  if (installed.hasManifest || (!local && comparable)) result.pluginsUnverified = installed.unverified;
  result.globalPluginsUnverified = installed.globalUnverified;
  result.pluginUpdates = [];
  result.pluginAhead = [];
  const comparisons = installed.found.map(async plugin => {
    const original = releaseTag(plugin.ref);
    const state = await stateFor(plugin.repo, plugin.channel);
    if (!state.latest) {
      if (plugin.scope === 'user') result.globalPluginsUnverified = true;
      else result.pluginsUnverified = true;
      return;
    }
    const target = releaseTag(state.latest.tag);
    if (compare(original, target) > 0) {
      result.pluginAhead.push({...plugin, targetRef:state.latest.tag});
      return;
    }
    const due = !Object.hasOwn(state.latest, 'pluginVersions') ||
      (state.latest.pluginVersions === null && (!Number.isFinite(state.latest.pluginVersionsCheckedAt) ||
        now < state.latest.pluginVersionsCheckedAt || now - state.latest.pluginVersionsCheckedAt >= HOUR));
    if (due) {
      state.versionsPromise ??= releasePluginVersions(fetcher, plugin.repo, state.latest.tag);
      state.latest.pluginVersions = await state.versionsPromise;
      state.latest.pluginVersionsCheckedAt = now;
      state.save = true;
    }
    const versions = state.latest.pluginVersions;
    if (!versions || typeof versions !== 'object') result.pluginsUnverified = true;
    const rawTargetVersion = versions?.[plugin.name];
    const targetVersion = semver(rawTargetVersion);
    if (!targetVersion) result.pluginsUnverified = true;
    if (targetVersion && compare(targetVersion, semver(plugin.version)) < 0) {
      result.pluginAhead.push({...plugin, targetRef:state.latest.tag, targetVersion:rawTargetVersion});
      return;
    }
    if (compare(original, target) < 0 || (targetVersion && compare(targetVersion, semver(plugin.version)) > 0))
      result.pluginUpdates.push({...plugin, targetRef:state.latest.tag, targetVersion:targetVersion ? rawTargetVersion : null});
  });
  if (currentState) {
    const state = await currentState;
    result.latest = state.latest;
    if (state.latest) result.checkedAt = state.checkedAt;
    else result.unavailable = true;
  }
  await Promise.all(comparisons);
  if (result.latest && comparable) {
    result.hasUpdate = compare(releaseTag(result.latest.tag), version) > 0;
    if (result.hasUpdate && current.scope === 'user' && installed.machineCount) {
      result.marketplaceUpdate = result.latest.tag;
      result.hasUpdate = false;
    }
  }
  if (!result.latest && comparable) result.pluginsUnverified = true;
  for (const promise of states.values()) {
    const state = await promise;
    if (state.save) saveCache(state.file, { checkedAt: state.checkedAt, latest: state.latest });
  }
  return result;
}

function format(result) {
  let message = result.version ? `AI-Driven Development ON · marketplace v${result.version}${result.local ? ' (version enregistrée)' : ''}` : 'AI-Driven Development ON · version du marketplace inconnue';
  if (result.latest) {
    const checkedAt = new Date(result.checkedAt);
    const checked = Number.isFinite(checkedAt.getTime()) ? ` (vérifiée le ${checkedAt.toISOString().slice(0,16).replace('T',' ')} UTC)` : '';
    const title = clean(result.latest.title);
    const detail = title && title !== result.latest.tag ? ` · ${title}` : result.latest.titlePending ? ' · titre indisponible' : '';
    message += result.local
      ? `\nDernière release officielle : ${result.latest.tag}${detail}${checked}`
      : `\nDernière release : ${title || result.latest.tag}${result.latest.titlePending && title === result.latest.tag ? ' · titre indisponible' : ''}${checked}`;
  }
  if (result.local && result.version && result.latest && compare(semver(result.latest.tag), semver(result.version)) > 0)
    message += `\nVersion enregistrée : v${result.version} → ${result.latest.tag} (comparaison indicative)`;
  if (result.local) message += '\nSource locale : le contenu peut différer de la release officielle';
  if (result.marketplaceUpdate) message += `\nMarketplace partagé : v${result.version} → ${result.marketplaceUpdate} (source inchangée)`;
  if (result.hasUpdate) {
    message += `\nMise à jour disponible : ${result.latest.tag} · skill aidd-maintenance · 01-update`;
  }
  const updates = result.pluginUpdates || [];
  const entries = [...updates, ...(result.pluginAhead || []).map(plugin => ({...plugin, ahead:true}))];
  entries.sort((a, b) => {
    const left = `${a.scope}:${a.tool}:${a.name}`; const right = `${b.scope}:${b.tool}:${b.name}`;
    return left < right ? -1 : left > right ? 1 : 0;
  });
  if (entries.length) message += '\nPlugins enregistrés par le CLI AIDD :';
  for (const plugin of entries.slice(0, 5)) {
    const identity = `${plugin.tool} · ${plugin.name} · ${plugin.scope === 'user' ? 'global' : 'projet'}`;
    if (plugin.ahead) {
      const conflict = plugin.targetVersion
        ? `version enregistrée ${plugin.version} supérieure à ${plugin.targetVersion}`
        : `source ${plugin.ref} supérieure à ${plugin.targetRef}`;
      message += `\n${identity} · ${conflict} : mise à jour non proposée`;
    } else {
      const targetVersion = plugin.targetVersion ? ` → ${plugin.targetVersion}` : ' → version cible inconnue';
      message += `\n${identity} · version enregistrée ${plugin.version}${targetVersion} · source ${plugin.ref} → ${plugin.targetRef}`;
    }
  }
  if (entries.length > 5) message += `\nEt ${entries.length - 5} autre${entries.length === 6 ? '' : 's'} installation${entries.length === 6 ? '' : 's'} à vérifier`;
  if (updates.length && !result.hasUpdate) message += '\nPour vérifier : skill aidd-maintenance · 01-update';
  if (result.comparisonUnavailable) message += `\n${result.comparisonUnavailable}`;
  if (result.pluginsUnverified) message += '\nÉtat de certains plugins non vérifié';
  if (result.globalPluginsUnverified) message += '\nÉtat des plugins globaux non vérifié';
  if (result.unavailable) message += '\nDernière release indisponible';
  return message;
}

function hookOutput(message, input) {
  // Cursor and Copilot document distinct session payloads and output fields.
  if (typeof input?.is_background_agent === 'boolean') return { additional_context: message };
  if (typeof input?.timestamp === 'string' || typeof input?.timestamp === 'number') return { additionalContext: message };
  // Claude and Codex both support systemMessage; Codex rejects unrelated fields.
  return { systemMessage: message };
}

if (require.main === module) {
  let input = {};
  try { input = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { /* An empty or malformed payload is still a valid startup. */ }
  const write = message => {
    const output = hookOutput(message, input);
    if (process.env.COPILOT_CLI !== undefined && Object.hasOwn(output, 'additionalContext'))
      process.stdout.write(`${JSON.stringify({type:'progress', message})}\n`);
    process.stdout.write(JSON.stringify(output));
  };
  status({tool:input.tool}).then(result => write(format(result)))
    .catch(() => write('AI-Driven Development ON · version du marketplace inconnue'));
}

module.exports = { status, format };
