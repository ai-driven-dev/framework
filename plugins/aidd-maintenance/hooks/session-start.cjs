#!/usr/bin/env node
// A catalogue version is not a claim about the individual plugins the host loaded.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const { semver, releaseTag, compare } = require('./lib/versions.cjs');
const { json, configDir, inspectInventory } = require('./lib/inventory.cjs');
const { clean, releaseTitle, latestRelease, releasePluginVersions } = require('./lib/releases.cjs');
const OFFICIAL_REPO = 'ai-driven-dev/framework';

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

async function status({ cwd = process.cwd(), env = process.env, home = os.homedir(), now = Date.now(), fetcher = fetch, tool, allNative = false, runner, sourceReader } = {}) {
  const inventory = await inspectInventory({cwd,env,home,tool,allNative,runner,sourceReader});
  const current = inventory.current;
  const version = semver(current?.version);
  const source = current?.source;
  const result = { version: version ? current.version.replace(/^v/, '') : null, latest: null, unavailable: false,
    inventory:{catalogues:inventory.catalogues,installations:inventory.installations,warnings:inventory.warnings} };
  const local = source?.kind === 'local';
  const pinned = releaseTag(source?.ref);
  const comparable = source?.kind === 'github' && REPO.test(source.repo || '') && pinned &&
    (version ? compare(pinned, version) === 0 : current.manager === 'native');
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
    ? stateFor(local ? OFFICIAL_REPO : source.repo, (version || pinned)?.prerelease[0] || '') : null;
  result.local = local;
  // A native Claude catalogue and the CLI's project/global registrations can be distinct.
  const installed = inventory.managed;
  const nativePlugins = inventory.installations.filter(plugin=>plugin.manager === 'native' && plugin.currentProject);
  if (installed.hasManifest || (!local && comparable && !nativePlugins.length)) result.pluginsUnverified = installed.unverified;
  result.globalPluginsUnverified = installed.globalUnverified;
  result.nativePluginsUnverified = inventory.warnings.length > 0;
  result.pluginUpdates = [];
  result.pluginAhead = [];
  const nativeComparable = nativePlugins.flatMap(plugin => {
    const source = plugin.source; const ref = releaseTag(source.ref);
    if (source.kind !== 'github' || !ref || !semver(plugin.version)) {
      if (source.kind !== 'local') result.nativePluginsUnverified = true;
      return [];
    }
    return [{...plugin,ref:source.ref,repo:source.repo,channel:ref.prerelease[0] || ''}];
  });
  const comparisons = [...installed.found,...nativeComparable].map(async plugin => {
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
    const rawTargetVersion = versions?.[plugin.name];
    const targetVersion = semver(rawTargetVersion);
    if (!targetVersion) {
      if (plugin.scope === 'user') result.globalPluginsUnverified = true;
      else result.pluginsUnverified = true;
    }
    if (targetVersion && compare(targetVersion, semver(plugin.version)) < 0) {
      result.pluginAhead.push({...plugin, targetRef:state.latest.tag, targetVersion:rawTargetVersion});
      return;
    }
    if (compare(original, target) < 0 || (targetVersion && compare(targetVersion, semver(plugin.version)) > 0))
      result.pluginUpdates.push({...plugin, targetRef:state.latest.tag, targetVersion:targetVersion ? rawTargetVersion : null,
        compareUrl:`https://github.com/${plugin.repo}/compare/${encodeURIComponent(plugin.ref)}...${encodeURIComponent(state.latest.tag)}`});
  });
  if (currentState) {
    const state = await currentState;
    result.latest = state.latest;
    if (state.latest) result.checkedAt = state.checkedAt;
    else result.unavailable = true;
  }
  await Promise.all(comparisons);
  if (result.latest && comparable) {
    result.hasUpdate = Boolean(version && compare(releaseTag(result.latest.tag), version) > 0);
    if (result.hasUpdate && current.manager === 'aidd' && current.scope === 'user' && installed.machineCount) {
      result.marketplaceUpdate = result.latest.tag;
      result.hasUpdate = false;
    }
  }
  if (!result.latest && comparable) result.pluginsUnverified = true;
  result.releases = [];
  for (const [key,promise] of states) {
    const state = await promise;
    if (state.save) saveCache(state.file, { checkedAt: state.checkedAt, latest: state.latest });
    if (state.latest) {
      const [repo,channel]=key.split(':');
      result.releases.push({repo,channel,tag:state.latest.tag,title:clean(state.latest.title),checkedAt:state.checkedAt,
        notesUrl:`https://github.com/${repo}/releases/tag/${encodeURIComponent(state.latest.tag)}`});
    }
  }
  return result;
}

function format(result) {
  let message = result.version ? `AI-Driven Development ON · marketplace v${result.version}${result.local ? ' (version enregistrée)' : ''}` : 'AI-Driven Development ON · version du marketplace inconnue';
  if (result.latest) {
    const checkedAt = new Date(result.checkedAt);
    const checked = Number.isFinite(checkedAt.getTime()) ? `\nVérifiée le ${checkedAt.toISOString().slice(0,16).replace('T',' ')} UTC` : '';
    const title = clean(result.latest.title);
    const detail = title && title !== result.latest.tag ? ` · ${title}` : result.latest.titlePending ? ' · titre indisponible' : '';
    message += `\n\nDernière release${result.local ? ' officielle' : ''} : ${result.latest.tag}${detail}${checked}`;
  }
  if (result.local && result.version && result.latest && compare(semver(result.latest.tag), semver(result.version)) > 0)
    message += `\nVersion enregistrée : v${result.version} → ${result.latest.tag} (comparaison indicative)`;
  if (result.local) message += '\nSource locale : le contenu peut différer de la release officielle';
  if (result.marketplaceUpdate) message += `\nMarketplace partagé : v${result.version} → ${result.marketplaceUpdate} (source inchangée)`;
  if (result.hasUpdate) {
    message += `\n\nMise à jour disponible : v${result.version} → ${result.latest.tag}\nPour mettre à jour : skill aidd-maintenance · 01-update`;
  }
  const updates = result.pluginUpdates || [];
  const entries = [...updates, ...(result.pluginAhead || []).map(plugin => ({...plugin, ahead:true}))];
  entries.sort((a, b) => {
    const left = `${a.scope}:${a.tool}:${a.name}`; const right = `${b.scope}:${b.tool}:${b.name}`;
    return left < right ? -1 : left > right ? 1 : 0;
  });
  if (entries.length) message += entries.every(plugin=>plugin.manager !== 'native')
    ? '\n\nPlugins enregistrés par le CLI AIDD :' : '\n\nPlugins installés :';
  for (const plugin of entries.slice(0, 5)) {
    const identity = `${plugin.tool} · ${plugin.name} · ${plugin.scope === 'user' ? 'global' : 'projet'}`;
    if (plugin.ahead) {
      const conflict = plugin.targetVersion
        ? `version enregistrée ${plugin.version} supérieure à ${plugin.targetVersion}`
        : `source ${plugin.ref} supérieure à ${plugin.targetRef}`;
      message += `\n  • ${identity} · ${conflict} : mise à jour non proposée`;
    } else {
      const targetVersion = plugin.targetVersion ? ` → ${plugin.targetVersion}` : ' → version cible inconnue';
      message += `\n  • ${identity} · version enregistrée ${plugin.version}${targetVersion} · source ${plugin.ref} → ${plugin.targetRef}`;
    }
  }
  if (entries.length > 5) message += `\nEt ${entries.length - 5} autre${entries.length === 6 ? '' : 's'} installation${entries.length === 6 ? '' : 's'} à vérifier`;
  if (updates.length && !result.hasUpdate) message += '\nPour vérifier : skill aidd-maintenance · 01-update';
  if (result.comparisonUnavailable) message += `\n${result.comparisonUnavailable}`;
  if (result.pluginsUnverified) message += '\nÉtat de certains plugins non vérifié';
  if (result.globalPluginsUnverified) message += '\nÉtat des plugins globaux non vérifié';
  if (result.nativePluginsUnverified) message += '\nÉtat de certains plugins natifs non vérifié';
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
  if (process.argv.includes('--json')) {
    const toolIndex=process.argv.indexOf('--tool');
    const tool=toolIndex === -1 ? undefined : process.argv[toolIndex+1];
    status({tool,allNative:tool === undefined}).then(result=>process.stdout.write(`${JSON.stringify(result,null,2)}\n`))
      .catch(()=>{process.stderr.write('Inspection AIDD indisponible.\n');process.exitCode=1;});
  } else {
  let input = {};
  try { input = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { /* An empty or malformed payload is still a valid startup. */ }
  const write = message => {
    const output = hookOutput(message, input);
    if (process.env.COPILOT_CLI !== undefined && Object.hasOwn(output, 'additionalContext'))
      process.stdout.write(`${JSON.stringify({type:'progress', message})}\n`);
    process.stdout.write(JSON.stringify(output));
  };
  const root=process.env.PLUGIN_ROOT || process.env.CLAUDE_PLUGIN_ROOT || '';
  const tool=input.tool || (process.env.COPILOT_CLI !== undefined ? 'copilot' :
    root.startsWith(`${process.env.CODEX_HOME || path.join(os.homedir(),'.codex')}${path.sep}`) ? 'codex' :
    root.startsWith(`${process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(),'.claude')}${path.sep}`) ? 'claude' : undefined);
  status({tool,cwd:typeof input.cwd === 'string' ? input.cwd : process.cwd()}).then(result => write(format(result)))
    .catch(() => write('AI-Driven Development ON · version du marketplace inconnue'));
  }
}

module.exports = { status, format };
