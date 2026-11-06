const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { status, format } = require('../../plugins/aidd-maintenance/hooks/session-start.cjs');

function fixture(t, source = { kind: 'github', repo: 'ai-driven-dev/framework', ref: 'v5.12.0' }, version = '5.12.0') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aidd-maintenance-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const project = path.join(dir, 'project');
  const config = path.join(dir, 'config');
  fs.mkdirSync(path.join(project, '.aidd'), { recursive: true });
  fs.mkdirSync(config, { recursive: true });
  fs.writeFileSync(path.join(project, '.aidd', 'marketplaces.json'), JSON.stringify({version:1, marketplaces:[{name:'aidd-framework', version, source}]}));
  return {cwd:project, home:dir, env:{AIDD_USER_CONFIG_DIR:config}, now:Date.parse('2026-11-04T00:00:00Z')};
}

function releases(calls, list) {
  return async (url) => {
    calls.push(url);
    if (url.includes('/releases?')) return {ok:true, json:async()=>list};
    if (url.includes('/releases/download/')) return {ok:true, json:async()=>({title:'Framework - Release 5.13 : Télémétrie et Plan'})};
    throw new Error(`unexpected ${url}`);
  };
}
const available = [{tag_name:'cli-v9.0.0'}, {tag_name:'v5.13.0',name:'v5.13.0',assets:[{name:'release-video.json'}],draft:false,prerelease:false}];

function plugin(name, ref, version, scope='project', overrides={}) {
  return {name, version, scope, marketplace:'aidd-framework', source:{kind:'git-subdir', url:'https://github.com/ai-driven-dev/framework.git', path:`plugins/${name}`, ref}, ...overrides};
}

function writeManifest(file, tools) {
  fs.mkdirSync(path.dirname(file), {recursive:true});
  fs.writeFileSync(file, JSON.stringify({version:8, tools}));
}

function releasesWithVersions(calls, list, versions) {
  const fetchRelease = releases(calls, list);
  return async url => {
    if (url.startsWith('https://raw.githubusercontent.com/')) {
      calls.push(url);
      return {ok:true, json:async()=>versions};
    }
    return fetchRelease(url);
  };
}

test('reports a recorded project plugin behind when the catalogue already is latest', async t => {
  const options=fixture(t,{kind:'github',repo:'ai-driven-dev/framework',ref:'v5.13.0'},'5.13.0');
  writeManifest(path.join(options.cwd,'.aidd','manifest.json'), {codex:{plugins:[plugin('aidd-context','v5.12.0','2.9.0')]}});
  const calls=[];
  const result=await status({...options,fetcher:releasesWithVersions(calls,available,{'.':'5.13.0','plugins/aidd-context':'2.10.0'})});
  const text=format(result);
  assert.match(text,/plugins enregistrés par le CLI AIDD/i);
  assert.match(text,/codex.*aidd-context/);
  assert.match(text,/2\.9\.0.*2\.10\.0/);
  assert.match(text,/v5\.12\.0.*v5\.13\.0/);
  assert.match(text,/01-update/);
  assert.equal(calls.filter(url=>url.startsWith('https://raw.githubusercontent.com/')).length,1);
});

test('checks installed plugin versions even when their source reference is current', async t => {
  const options=fixture(t,{kind:'github',repo:'ai-driven-dev/framework',ref:'v5.13.0'},'5.13.0');
  writeManifest(path.join(options.cwd,'.aidd','manifest.json'), {codex:{plugins:[plugin('aidd-context','v5.13.0','2.9.0')]}});
  const result=await status({...options,fetcher:releasesWithVersions([],available,{'.':'5.13.0','plugins/aidd-context':'2.10.0'})});
  assert.match(format(result),/codex.*aidd-context.*2\.9\.0.*2\.10\.0/);
});

test('distinguishes project and user plugins and reads each authoritative manifest only once', async t => {
  const options=fixture(t,{kind:'github',repo:'ai-driven-dev/framework',ref:'v5.13.0'},'5.13.0');
  writeManifest(path.join(options.cwd,'.aidd','manifest.json'), {
    codex:{plugins:[plugin('aidd-context','v5.12.0','2.9.0')]},
    cursor:{plugins:[plugin('aidd-dev','v5.12.0','2.6.0','user')]},
  });
  writeManifest(path.join(options.env.AIDD_USER_CONFIG_DIR,'manifest.json'), {
    cursor:{plugins:[plugin('aidd-dev','v5.12.0','2.6.0','user')]},
  });
  fs.writeFileSync(path.join(options.env.AIDD_USER_CONFIG_DIR,'marketplaces.json'),JSON.stringify({version:1,marketplaces:[{name:'aidd-framework',version:'5.13.0',source:{kind:'github',repo:'ai-driven-dev/framework',ref:'v5.13.0'}}]}));
  const calls=[];
  const result=await status({...options,fetcher:releasesWithVersions(calls,available,{'.':'5.13.0','plugins/aidd-context':'2.10.0','plugins/aidd-dev':'2.7.1'})});
  const text=format(result);
  assert.match(text,/codex.*aidd-context.*projet/i);
  assert.match(text,/cursor.*aidd-dev.*global/i);
  assert.equal((text.match(/cursor.*aidd-dev/g)||[]).length,1);
  assert.equal(calls.filter(url=>url.startsWith('https://raw.githubusercontent.com/')).length,1);
});

test('does not repeatedly propose the same global update when only the shared marketplace remains pinned', async t => {
  const options=fixture(t);
  fs.rmSync(path.join(options.cwd,'.aidd'),{recursive:true,force:true});
  fs.writeFileSync(path.join(options.env.AIDD_USER_CONFIG_DIR,'marketplaces.json'), JSON.stringify({version:1,marketplaces:[{name:'aidd-framework',version:'5.12.0',source:{kind:'github',repo:'ai-driven-dev/framework',ref:'v5.12.0'}}]}));
  writeManifest(path.join(options.env.AIDD_USER_CONFIG_DIR,'manifest.json'), {opencode:{plugins:[plugin('aidd-context','v5.13.0','2.10.0','user')]}});
  const text=format(await status({...options,fetcher:releasesWithVersions([],available,{'.':'5.13.0','plugins/aidd-context':'2.10.0'})}));
  assert.match(text,/marketplace.*v5\.12\.0/i);
  assert.match(text,/marketplace partagé.*v5\.12\.0.*v5\.13\.0/i);
  assert.doesNotMatch(text,/mise à jour disponible/i);
  assert.doesNotMatch(text,/01-update/i);
});

test('does not claim global plugins are up to date when target versions cannot be verified', async t => {
  const options=fixture(t);
  fs.rmSync(path.join(options.cwd,'.aidd'),{recursive:true,force:true});
  fs.writeFileSync(path.join(options.env.AIDD_USER_CONFIG_DIR,'marketplaces.json'), JSON.stringify({version:1,marketplaces:[{name:'aidd-framework',version:'5.12.0',source:{kind:'github',repo:'ai-driven-dev/framework',ref:'v5.12.0'}}]}));
  writeManifest(path.join(options.env.AIDD_USER_CONFIG_DIR,'manifest.json'), {opencode:{plugins:[plugin('aidd-context','v5.13.0','2.10.0','user')]}});
  const text=format(await status({...options,fetcher:releases([],available)}));
  assert.match(text,/marketplace partagé.*v5\.12\.0.*v5\.13\.0/i);
  assert.match(text,/plugins globaux non vérifié/i);
  assert.doesNotMatch(text,/certains plugins non vérifié/i);
  assert.doesNotMatch(text,/à jour/i);
});

test('attributes malformed entries to their manifest scope', async t => {
  const options=fixture(t,{kind:'github',repo:'ai-driven-dev/framework',ref:'v5.13.0'},'5.13.0');
  const project=path.join(options.cwd,'.aidd','manifest.json');
  const user=path.join(options.env.AIDD_USER_CONFIG_DIR,'manifest.json');
  fs.writeFileSync(path.join(options.env.AIDD_USER_CONFIG_DIR,'marketplaces.json'),JSON.stringify({version:1,marketplaces:[{name:'aidd-framework',version:'5.13.0',source:{kind:'github',repo:'ai-driven-dev/framework',ref:'v5.13.0'}}]}));
  const invalid=[
    {'BAD!':{plugins:[]}},
    {codex:null},
    {codex:[]},
    {codex:{plugins:{}}},
    {codex:{plugins:[null]}},
    {codex:{plugins:['invalid']}},
    {codex:{plugins:[plugin('aidd-dev','v5.13.0','2.7.1','project',{marketplace:undefined})]}},
    {codex:{plugins:[plugin('INVALID!','v5.13.0','2.7.1')]}},
  ];
  for (const scope of ['project','user']) {
    for (const entries of invalid) {
      writeManifest(project,scope==='project'?entries:{});
      writeManifest(user,scope==='user'?entries:{});
      const result=await status({...options,fetcher:releasesWithVersions([],available,{'.':'5.13.0'})});
      assert.equal(Boolean(result.pluginsUnverified),scope==='project');
      assert.equal(Boolean(result.globalPluginsUnverified),scope==='user');
    }
  }
});

test('does not report local, unrelated, malformed, or up-to-date plugins as updates', async t => {
  const options=fixture(t,{kind:'github',repo:'ai-driven-dev/framework',ref:'v5.13.0'},'5.13.0');
  writeManifest(path.join(options.cwd,'.aidd','manifest.json'), {codex:{plugins:[
    plugin('aidd-context','v5.13.0','2.10.0'),
    plugin('aidd-local','v5.12.0','1.0.0','project',{source:{kind:'local',path:'/repo'}}),
    plugin('other','v5.12.0','1.0.0','project',{marketplace:'other'}),
    plugin('broken','v5.12.0','1.0.0','project',{source:{kind:'git-subdir',url:'https://example.com/other.git',path:'plugins/broken',ref:'v5.12.0'}}),
    null,
  ]}});
  const result=await status({...options,fetcher:releasesWithVersions([],available,{'.':'5.13.0','plugins/aidd-context':'2.10.0'})});
  const text=format(result);
  assert.doesNotMatch(text,/aidd-context|aidd-local|other|broken/);
  assert.doesNotMatch(text,/mise à jour disponible/i);
});

test('does not invent a target plugin version when release metadata is missing or mismatched', async t => {
  const options=fixture(t,{kind:'github',repo:'ai-driven-dev/framework',ref:'v5.13.0'},'5.13.0');
  writeManifest(path.join(options.cwd,'.aidd','manifest.json'), {codex:{plugins:[plugin('aidd-context','v5.12.0','2.9.0')]}});
  const result=await status({...options,fetcher:releasesWithVersions([],available,{'.':'5.12.0','plugins/aidd-context':'9.9.9'})});
  const text=format(result);
  assert.match(text,/codex.*aidd-context.*v5\.12\.0.*v5\.13\.0/);
  assert.doesNotMatch(text,/9\.9\.9/);
});

test('offline or malformed manifests cannot produce a fabricated plugin update', async t => {
  const options=fixture(t);
  writeManifest(path.join(options.cwd,'.aidd','manifest.json'), {codex:{plugins:[plugin('aidd-context','v5.11.0','2.9.0')]}});
  const result=await status({...options,fetcher:async()=>{throw Error('offline');}});
  assert.doesNotMatch(format(result),/aidd-context|mise à jour disponible/i);
  fs.writeFileSync(path.join(options.cwd,'.aidd','manifest.json'),'{bad json');
  const malformed=await status({...options,fetcher:releasesWithVersions([],available,{'.':'5.13.0','plugins/aidd-context':'2.10.0'})});
  assert.doesNotMatch(format(malformed),/aidd-context/);
});

test('caches the verified target plugin versions with the release for one day', async t => {
  const options=fixture(t);
  writeManifest(path.join(options.cwd,'.aidd','manifest.json'), {codex:{plugins:[plugin('aidd-context','v5.12.0','2.9.0')]}});
  const calls=[]; const fetcher=releasesWithVersions(calls,available,{'.':'5.13.0','plugins/aidd-context':'2.10.0'});
  await status({...options,fetcher});
  const next=await status({...options,now:options.now+23*3600000,fetcher});
  assert.equal(calls.filter(url=>url.startsWith('https://raw.githubusercontent.com/')).length,1);
  assert.match(format(next),/2\.9\.0.*2\.10\.0/);
});

test('does not propose a release tag the update command cannot accept', async t => {
  const options=fixture(t);
  const choices=[{tag_name:'9.0.0',name:'No v',assets:[],draft:false,prerelease:false},...available];
  const result=await status({...options,fetcher:releases([],choices)});
  assert.equal(result.latest.tag,'v5.13.0');
});

test('invalid or unsupported manifests leave plugin state explicitly unverified', async t => {
  const options=fixture(t);
  const manifest=path.join(options.cwd,'.aidd','manifest.json');
  fs.writeFileSync(manifest,'{bad json');
  assert.match(format(await status({...options,fetcher:releases([],available)})),/plugins non vérifié/i);
  fs.writeFileSync(manifest,JSON.stringify({version:6,tools:{codex:{plugins:[plugin('aidd-context','v5.12.0','2.9.0')]}}}));
  assert.match(format(await status({...options,fetcher:releases([],available)})),/plugins non vérifié/i);
});

test('does not invent a version target when a release lacks plugin metadata', async t => {
  const options=fixture(t);
  writeManifest(path.join(options.cwd,'.aidd','manifest.json'), {codex:{plugins:[plugin('aidd-context','v5.12.0','2.9.0')]}});
  const calls=[]; const fetcher=async url=>{
    if(url.startsWith('https://raw.githubusercontent.com/')) { calls.push(url); throw Error('offline'); }
    return releases(calls,available)(url);
  };
  const first=await status({...options,fetcher});
  assert.match(format(first),/aidd-context.*version cible inconnue/);
  assert.match(format(first),/plugins non vérifié/i);
  const next=await status({...options,now:options.now+30*60000,fetcher});
  assert.match(format(next),/version cible inconnue/);
  assert.equal(calls.filter(url=>url.startsWith('https://raw.githubusercontent.com/')).length,1);
});

test('retries unavailable target versions after one hour without refreshing the release', async t => {
  const options=fixture(t); const calls=[];
  writeManifest(path.join(options.cwd,'.aidd','manifest.json'), {codex:{plugins:[plugin('aidd-context','v5.12.0','2.9.0')]}});
  const failing=async url=>{
    if(url.startsWith('https://raw.githubusercontent.com/')) { calls.push(url); throw Error('offline'); }
    return releases(calls,available)(url);
  };
  assert.match(format(await status({...options,fetcher:failing})),/version cible inconnue/);
  const next=await status({...options,now:options.now+3600000,fetcher:releasesWithVersions(calls,available,{'.':'5.13.0','plugins/aidd-context':'2.10.0'})});
  assert.match(format(next),/2\.9\.0.*2\.10\.0/);
  assert.equal(calls.filter(url=>url.includes('/releases?')).length,1);
  assert.equal(calls.filter(url=>url.startsWith('https://raw.githubusercontent.com/')).length,2);
});

test('adds plugin versions to an existing release-only cache without refreshing the release', async t => {
  const options=fixture(t); const calls=[];
  await status({...options,fetcher:releases(calls,available)});
  writeManifest(path.join(options.cwd,'.aidd','manifest.json'), {codex:{plugins:[plugin('aidd-context','v5.12.0','2.9.0')]}});
  const next=await status({...options,now:options.now+23*3600000,fetcher:releasesWithVersions(calls,available,{'.':'5.13.0','plugins/aidd-context':'2.10.0'})});
  assert.match(format(next),/2\.9\.0.*2\.10\.0/);
  assert.equal(calls.filter(url=>url.includes('/releases?')).length,1);
  assert.equal(calls.filter(url=>url.startsWith('https://raw.githubusercontent.com/')).length,1);
});

test('shows at most five recorded plugin installations in a stable order', async t => {
  const options=fixture(t,{kind:'github',repo:'ai-driven-dev/framework',ref:'v5.13.0'},'5.13.0');
  const entries=['zulu','echo','delta','charlie','bravo','alpha'].map(name=>plugin(name,'v5.12.0','1.0.0'));
  writeManifest(path.join(options.cwd,'.aidd','manifest.json'), {codex:{plugins:entries}});
  const versions={'.':'5.13.0'}; for(const entry of entries) versions[`plugins/${entry.name}`]='2.0.0';
  const text=format(await status({...options,fetcher:releasesWithVersions([],available,versions)}));
  assert.match(text,/codex · alpha/);
  assert.doesNotMatch(text,/codex · zulu/);
  assert.match(text,/1 autre installation/);
});

test('does not propose a release older than an installed plugin source even when the plugin version is older', async t => {
  const options=fixture(t,{kind:'github',repo:'ai-driven-dev/framework',ref:'v5.13.0'},'5.13.0');
  writeManifest(path.join(options.cwd,'.aidd','manifest.json'), {codex:{plugins:[plugin('aidd-context','v5.14.0','2.9.0')]}});
  const result=await status({...options,fetcher:releasesWithVersions([],available,{'.':'5.13.0','plugins/aidd-context':'2.10.0'})});
  const text=format(result);
  assert.match(text,/codex.*aidd-context.*v5\.14\.0.*v5\.13\.0/);
  assert.match(text,/non propos/i);
  assert.doesNotMatch(text,/mise à jour disponible/i);
  assert.equal(result.pluginUpdates.length,0);
});

test('does not propose downgrading an installed plugin even if its source reference is older', async t => {
  const options=fixture(t,{kind:'github',repo:'ai-driven-dev/framework',ref:'v5.13.0'},'5.13.0');
  writeManifest(path.join(options.cwd,'.aidd','manifest.json'), {codex:{plugins:[plugin('aidd-context','v5.12.0','3.0.0')]}});
  const result=await status({...options,fetcher:releasesWithVersions([],available,{'.':'5.13.0','plugins/aidd-context':'2.10.0'})});
  const text=format(result);
  assert.match(text,/codex.*aidd-context.*3\.0\.0.*2\.10\.0/);
  assert.match(text,/non propos/i);
  assert.doesNotMatch(text,/mise à jour disponible/i);
  assert.equal(result.pluginUpdates.length,0);
});

test('keeps prerelease and stable source channels separate', async t => {
  const options=fixture(t,{kind:'github',repo:'ai-driven-dev/framework',ref:'v5.13.0-beta.1'},'5.13.0-beta.1');
  writeManifest(path.join(options.cwd,'.aidd','manifest.json'), {codex:{plugins:[plugin('aidd-context','v5.12.0','2.9.0')]}});
  const choices=[{tag_name:'v5.13.0-beta.2',name:'Beta two',assets:[],draft:false,prerelease:true}];
  const result=await status({...options,fetcher:releasesWithVersions([],choices,{'.':'5.13.0-beta.2','plugins/aidd-context':'2.10.0-beta.1'})});
  assert.equal(result.pluginUpdates.length,0);
  assert.match(format(result),/plugins non vérifié/i);
});

test('never compares global plugins against a different local user marketplace', async t => {
  const options=fixture(t,{kind:'github',repo:'ai-driven-dev/framework',ref:'v5.13.0'},'5.13.0');
  writeManifest(path.join(options.env.AIDD_USER_CONFIG_DIR,'manifest.json'), {cursor:{plugins:[plugin('aidd-dev','v5.12.0','2.6.0','user')]}});
  fs.writeFileSync(path.join(options.env.AIDD_USER_CONFIG_DIR,'marketplaces.json'),JSON.stringify({version:1,marketplaces:[{name:'aidd-framework',version:'5.13.0',source:{kind:'local',path:'/other'}}]}));
  const result=await status({...options,fetcher:releasesWithVersions([],available,{'.':'5.13.0','plugins/aidd-dev':'2.7.1'})});
  assert.doesNotMatch(format(result),/cursor.*aidd-dev/);
  assert.match(format(result),/plugins globaux non vérifié/i);
});

test('compares official global plugins independently of a local project source', async t => {
  const options=fixture(t,{kind:'local',path:'/local/framework'});
  writeManifest(path.join(options.env.AIDD_USER_CONFIG_DIR,'manifest.json'), {opencode:{plugins:[plugin('aidd-dev','v5.12.0','2.6.0','user')]}});
  fs.writeFileSync(path.join(options.env.AIDD_USER_CONFIG_DIR,'marketplaces.json'),JSON.stringify({version:1,marketplaces:[{name:'aidd-framework',version:'5.12.0',source:{kind:'github',repo:'ai-driven-dev/framework',ref:'v5.12.0'}}]}));
  const result=await status({...options,fetcher:releasesWithVersions([],available,{'.':'5.13.0','plugins/aidd-dev':'2.7.1'})});
  assert.match(format(result),/opencode.*aidd-dev.*global.*2\.6\.0.*2\.7\.1/i);
  assert.match(format(result),/source locale.*contenu.*différer/i);
  assert.doesNotMatch(format(result),/plugins.*non vérifié/i);
});

test('compares global prereleases on their channel even with a local project', async t => {
  const options=fixture(t,{kind:'local',path:'/local/framework'});
  writeManifest(path.join(options.env.AIDD_USER_CONFIG_DIR,'manifest.json'), {kilo:{plugins:[plugin('aidd-dev','v5.13.0-beta.1','2.7.0-beta.1','user')]}});
  fs.writeFileSync(path.join(options.env.AIDD_USER_CONFIG_DIR,'marketplaces.json'),JSON.stringify({version:1,marketplaces:[{name:'aidd-framework',version:'5.13.0-beta.1',source:{kind:'github',repo:'ai-driven-dev/framework',ref:'v5.13.0-beta.1'}}]}));
  const choices=[...available,{tag_name:'v5.13.0-beta.2',name:'Beta two',assets:[],draft:false,prerelease:true}];
  const fetcher=async url => url.startsWith('https://raw.githubusercontent.com/')
    ? {ok:true,json:async()=>({'.':'5.13.0-beta.2','plugins/aidd-dev':'2.7.0-beta.2'})}
    : releases([],choices)(url);
  const text=format(await status({...options,fetcher}));
  assert.match(text,/kilo.*aidd-dev.*2\.7\.0-beta\.1.*2\.7\.0-beta\.2/i);
  assert.match(text,/source.*v5\.13\.0-beta\.1.*v5\.13\.0-beta\.2/i);
});

test('compares each global plugin on its own channel when the registry is stable', async t => {
  const options=fixture(t,{kind:'local',path:'/local/framework'});
  writeManifest(path.join(options.env.AIDD_USER_CONFIG_DIR,'manifest.json'), {kilo:{plugins:[plugin('aidd-dev','v5.12.0-beta.1','2.7.0-beta.1','user')]}});
  fs.writeFileSync(path.join(options.env.AIDD_USER_CONFIG_DIR,'marketplaces.json'),JSON.stringify({version:1,marketplaces:[{name:'aidd-framework',version:'5.12.0',source:{kind:'github',repo:'ai-driven-dev/framework',ref:'v5.12.0'}}]}));
  const choices=[...available,{tag_name:'v5.13.0-beta.2',name:'Beta two',assets:[],draft:false,prerelease:true}];
  const fetcher=async url => url.startsWith('https://raw.githubusercontent.com/')
    ? {ok:true,json:async()=>({'.':'5.13.0-beta.2','plugins/aidd-dev':'2.7.0-beta.2'})}
    : releases([],choices)(url);
  const text=format(await status({...options,fetcher}));
  assert.match(text,/kilo.*aidd-dev.*2\.7\.0-beta\.1.*2\.7\.0-beta\.2/i);
  assert.match(text,/source.*v5\.12\.0-beta\.1.*v5\.13\.0-beta\.2/i);
  assert.doesNotMatch(text,/source.*v5\.12\.0-beta\.1.*v5\.13\.0(?:\s|$)/i);
});

test('fetches independent project and global release channels concurrently', {timeout:2000}, async t => {
  const options=fixture(t);
  writeManifest(path.join(options.cwd,'.aidd','manifest.json'),{opencode:{plugins:[plugin('aidd-context','v5.12.0','2.9.0')]}});
  writeManifest(path.join(options.env.AIDD_USER_CONFIG_DIR,'manifest.json'),{kilo:{plugins:[plugin('aidd-dev','v5.13.0-beta.1','2.7.0-beta.1','user')]}});
  fs.writeFileSync(path.join(options.env.AIDD_USER_CONFIG_DIR,'marketplaces.json'),JSON.stringify({version:1,marketplaces:[{name:'aidd-framework',version:'5.13.0-beta.1',source:{kind:'github',repo:'ai-driven-dev/framework',ref:'v5.13.0-beta.1'}}]}));
  const choices=[...available,{tag_name:'v5.13.0-beta.2',name:'Beta two',assets:[],draft:false,prerelease:true}];
  const pending=[];
  const fetcher=async url => {
    if (url.includes('/releases?')) return new Promise(resolve=>{
      pending.push(resolve);
      if (pending.length===2) for (const finish of pending) finish({ok:true,json:async()=>choices});
    });
    if (url.startsWith('https://raw.githubusercontent.com/')) return {ok:true,json:async()=>url.includes('beta')
      ? {'.':'5.13.0-beta.2','plugins/aidd-dev':'2.7.0-beta.2'}
      : {'.':'5.13.0','plugins/aidd-context':'2.10.0'}};
    return {ok:true,json:async()=>({title:'Release'})};
  };
  const result=await status({...options,fetcher});
  assert.equal(pending.length,2);
  assert.match(format(result),/opencode.*aidd-context.*2\.9\.0.*2\.10\.0/i);
  assert.match(format(result),/kilo.*aidd-dev.*2\.7\.0-beta\.1.*2\.7\.0-beta\.2/i);
});

test('does not compare a project plugin against a different registry when its own registry is corrupt', async t => {
  const options=fixture(t);
  fs.writeFileSync(path.join(options.cwd,'.aidd','marketplaces.json'),'{bad json');
  writeManifest(path.join(options.cwd,'.aidd','manifest.json'),{codex:{plugins:[plugin('aidd-context','v5.12.0','2.9.0')]}});
  writeManifest(path.join(options.env.AIDD_USER_CONFIG_DIR,'manifest.json'),{opencode:{plugins:[plugin('aidd-dev','v5.12.0','2.6.0','user')]}});
  fs.writeFileSync(path.join(options.env.AIDD_USER_CONFIG_DIR,'marketplaces.json'),JSON.stringify({version:1,marketplaces:[{name:'aidd-framework',version:'5.12.0',source:{kind:'github',repo:'ai-driven-dev/framework',ref:'v5.12.0'}}]}));
  const text=format(await status({...options,fetcher:releasesWithVersions([],available,{'.':'5.13.0','plugins/aidd-context':'2.10.0','plugins/aidd-dev':'2.7.1'})}));
  assert.match(text,/source du marketplace inconnue/i);
  assert.doesNotMatch(text,/codex.*aidd-context/i);
  assert.match(text,/opencode.*aidd-dev.*2\.6\.0.*2\.7\.1/i);
});

test('does not invent a target for a local project referencing a global plugin', async t => {
  const options=fixture(t,{kind:'local',path:'/local/framework'});
  writeManifest(path.join(options.cwd,'.aidd','manifest.json'), {cursor:{plugins:[plugin('aidd-dev','v5.12.0','2.6.0','user')]}});
  const result=await status({...options,fetcher:releases([],available)});
  assert.match(format(result),/source locale.*contenu.*différer/i);
  assert.match(format(result),/plugins globaux non vérifié/i);
});

test('official git plugins without marketplace ownership are explicitly unverified', async t => {
  const options=fixture(t,{kind:'github',repo:'ai-driven-dev/framework',ref:'v5.13.0'},'5.13.0');
  const direct=plugin('aidd-context','v5.12.0','2.9.0'); delete direct.marketplace;
  writeManifest(path.join(options.cwd,'.aidd','manifest.json'), {codex:{plugins:[direct]}});
  const result=await status({...options,fetcher:releases([],available)});
  assert.doesNotMatch(format(result),/codex.*aidd-context/);
  assert.match(format(result),/plugins non vérifié/i);
});

test('marks a missing machine-owned plugin as globally unverified', async t => {
  const options=fixture(t,{kind:'github',repo:'ai-driven-dev/framework',ref:'v5.13.0'},'5.13.0');
  writeManifest(path.join(options.cwd,'.aidd','manifest.json'), {cursor:{plugins:[plugin('aidd-dev','v5.12.0','2.6.0','user')]}});
  writeManifest(path.join(options.env.AIDD_USER_CONFIG_DIR,'manifest.json'), {cursor:{plugins:[]}});
  fs.writeFileSync(path.join(options.env.AIDD_USER_CONFIG_DIR,'marketplaces.json'),JSON.stringify({version:1,marketplaces:[{name:'aidd-framework',version:'5.13.0',source:{kind:'github',repo:'ai-driven-dev/framework',ref:'v5.13.0'}}]}));
  const result=await status({...options,fetcher:releases([],available)});
  assert.match(format(result),/plugins globaux non vérifié/i);
  assert.doesNotMatch(format(result),/cursor.*aidd-dev/);
});

test('a matching plugin under a different tool does not satisfy the project user reference', async t => {
  const options=fixture(t,{kind:'github',repo:'ai-driven-dev/framework',ref:'v5.13.0'},'5.13.0');
  writeManifest(path.join(options.cwd,'.aidd','manifest.json'), {cursor:{plugins:[plugin('aidd-dev','v5.12.0','2.6.0','user')]}});
  writeManifest(path.join(options.env.AIDD_USER_CONFIG_DIR,'manifest.json'), {codex:{plugins:[plugin('aidd-dev','v5.12.0','2.6.0','user')]}});
  fs.writeFileSync(path.join(options.env.AIDD_USER_CONFIG_DIR,'marketplaces.json'),JSON.stringify({version:1,marketplaces:[{name:'aidd-framework',version:'5.13.0',source:{kind:'github',repo:'ai-driven-dev/framework',ref:'v5.13.0'}}]}));
  const result=await status({...options,fetcher:releasesWithVersions([],available,{'.':'5.13.0','plugins/aidd-dev':'2.7.1'})});
  assert.match(format(result),/plugins globaux non vérifié/i);
  assert.match(format(result),/codex.*aidd-dev/);
  assert.doesNotMatch(format(result),/cursor.*aidd-dev/);
});

test('matches the CLI semver treatment of build metadata', async t => {
  const options=fixture(t,{kind:'github',repo:'ai-driven-dev/framework',ref:'v5.12.0+build.1'},'5.12.0');
  const result=await status({...options,fetcher:releases([],available)});
  assert.equal(result.latest.tag,'v5.13.0');
  assert.equal(result.hasUpdate,true);
});

test('reports a verified catalogue diff and editorial title', async t => {
  const options = fixture(t); const calls=[];
  const text = format(await status({...options, fetcher:releases(calls, available)}), {CLAUDE_PLUGIN_ROOT:'/plugin'});
  assert.match(text,/marketplace v5\.12\.0/);
  assert.match(text,/Framework - Release 5\.13 : Télémétrie et Plan/);
  assert.match(text,/v5\.13\.0/);
  assert.match(text,/skill aidd-maintenance · 01-update/);
  assert.equal(calls.length,2);
});

test('shows the release tag with its title even when the marketplace is current', async t => {
  const options=fixture(t,{kind:'github',repo:'ai-driven-dev/framework',ref:'v5.13.0'},'5.13.0');
  const text=format(await status({...options,fetcher:releases([],available)}));
  const releaseLine=text.split('\n').find(line=>line.includes('Dernière release'));
  assert.match(releaseLine,/v5\.13\.0/);
  assert.match(releaseLine,/Télémétrie et Plan/);
});

test('dates a release from the cache and refreshes it after 24 hours', async t => {
  const options = fixture(t); const calls=[]; const fetcher=releases(calls, available);
  const now=Date.parse('2026-11-04T23:30:00Z');
  const first=await status({...options,now,fetcher});
  assert.match(format(first),/vérifi.*2026-11-04 23:30 UTC/i);
  const next = await status({...options,now:now+23*3600000,fetcher});
  assert.equal(calls.length,2);
  assert.match(format(next),/vérifi.*2026-11-04 23:30 UTC/i);
  assert.match(format(next, {}),/v5\.13\.0/);
  const refreshed=await status({...options,now:now+86400000,fetcher});
  assert.equal(calls.length,4);
  assert.match(format(refreshed),/vérifi.*2026-11-05 23:30 UTC/i);
});

test('network failure never presents unknown state as up to date', async t => {
  const options=fixture(t);
  const text=format(await status({...options,fetcher:async()=>{throw Error('offline');}}),{});
  assert.match(text,/marketplace v5\.12\.0/);
  assert.doesNotMatch(text,/up.to.date|à jour/i);
  assert.doesNotMatch(text,/mise à jour disponible/i);
});

test('reports the official release separately from the registered local version', async t => {
  const options=fixture(t,{kind:'local',path:'/local/framework'}); const calls=[];
  const text=format(await status({...options,fetcher:releases(calls,available)}),{});
  assert.match(text,/marketplace.*v5\.12\.0.*enregistrée/i);
  assert.match(text,/release officielle.*v5\.13\.0.*Framework - Release 5\.13 : Télémétrie et Plan/i);
  assert.match(text,/version enregistrée.*v5\.12\.0.*v5\.13\.0.*indicati/i);
  assert.match(text,/source locale.*contenu.*différer/i);
  assert.doesNotMatch(text,/plugins.*non vérifié/i);
  assert.equal(calls.length,2);
  assert.doesNotMatch(text,/mise à jour disponible/i);
  assert.doesNotMatch(text,/01-update/);
});

test('equal local and official versions do not imply identical content', async t => {
  const options=fixture(t,{kind:'local',path:'/local/framework'},'5.13.0');
  const text=format(await status({...options,fetcher:releases([],available)}));
  assert.match(text,/marketplace.*v5\.13\.0.*enregistrée/i);
  assert.match(text,/release officielle.*v5\.13\.0/i);
  assert.match(text,/source locale.*contenu.*différer/i);
  assert.doesNotMatch(text,/identique|à jour|mise à jour disponible/i);
});

test('retries unavailable release title without waiting for the daily release refresh', async t => {
  const options=fixture(t,{kind:'local',path:'/local/framework'}); const calls=[];
  const fetcher=async url => {
    calls.push(url);
    if (url.includes('/releases?')) return {ok:true,json:async()=>available};
    return {ok:false};
  };
  const first=await status({...options,fetcher});
  assert.match(format(first),/titre.*indisponible/i);
  assert.doesNotMatch(format(first),/v5\.13\.0\s*·\s*v5\.13\.0/);
  const early=[];
  await status({...options,now:options.now+3599999,fetcher:releases(early,available)});
  assert.equal(early.length,0);
  const retry=[];
  const recovered=await status({...options,now:options.now+3600000,fetcher:releases(retry,available)});
  assert.equal(retry.length,1);
  assert.match(format(recovered),/Télémétrie et Plan/);
  assert.doesNotMatch(format(recovered),/titre.*indisponible/i);
});

test('caches the official release for a local source and handles offline state', async t => {
  const options=fixture(t,{kind:'local',path:'/local/framework'}); const calls=[];
  const first=await status({...options,fetcher:releases(calls,available)});
  const cached=await status({...options,now:options.now+23*3600000,fetcher:async()=>{throw Error('offline');}});
  assert.equal(calls.length,2);
  assert.deepEqual(cached.latest,first.latest);
  assert.match(format(cached),/vérifi.*2026-11-04 00:00 UTC/i);
  const offline=await status({...options,now:options.now+86400000,fetcher:async()=>{throw Error('offline');}});
  assert.match(format(offline),/release.*indisponible/i);
  assert.doesNotMatch(format(offline),/indicati|mise à jour disponible/i);
});

test('a local source with no declared version shows the official release without a version diff', async t => {
  const options=fixture(t,{kind:'local',path:'/custom/fork'},'unknown');
  const text=format(await status({...options,fetcher:releases([],available)}));
  assert.match(text,/version du marketplace inconnue/i);
  assert.match(text,/release officielle.*v5\.13\.0/i);
  assert.doesNotMatch(text,/indicati|mise à jour disponible/i);
});

test('a beta installation compares releases from its own channel', async t => {
  const options=fixture(t,{kind:'github',repo:'ai-driven-dev/framework',ref:'v5.13.0-beta.1'},'5.13.0-beta.1');
  const choices=[{tag_name:'v5.13.0',name:'stable',assets:[],draft:false,prerelease:false},{tag_name:'v5.13.0-beta.2',name:'Beta two',assets:[],draft:false,prerelease:true}];
  const text=format(await status({...options,fetcher:releases([],choices)}),{});
  assert.match(text,/v5\.13\.0-beta\.2/);
  assert.match(text,/Beta two/);
  assert.doesNotMatch(text,/stable/);
});

test('the actual hook emits JSON with a visible unknown version without network', t => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aidd-maintenance-hook-')); t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const child=spawnSync(process.execPath,[path.resolve(__dirname,'../../plugins/aidd-maintenance/hooks/session-start.cjs')],{cwd:dir,encoding:'utf8',env:{PATH:process.env.PATH,HOME:dir,AIDD_USER_CONFIG_DIR:dir},input:'{}'});
  assert.equal(child.status,0,child.stderr);
  const output=JSON.parse(child.stdout);
  assert.match(output.systemMessage,/version.*unknown|version.*inconnue/i);
  assert.match(output.systemMessage,/source.*inconnue.*comparaison indisponible/i);
});

test('Claude native catalogue is only used when running in Claude', async t => {
  const options = fixture(t);
  fs.rmSync(path.join(options.cwd, '.aidd'), {recursive:true, force:true});
  const native = path.join(options.home, '.claude', 'plugins');
  const installed = path.join(options.home, 'native-marketplace');
  fs.mkdirSync(native, {recursive:true});
  fs.mkdirSync(path.join(installed, '.claude-plugin'), {recursive:true});
  fs.writeFileSync(path.join(native, 'known_marketplaces.json'), JSON.stringify({'aidd-framework':{installLocation:installed, source:{source:'directory'}}}));
  fs.writeFileSync(path.join(installed, '.claude-plugin', 'marketplace.json'), JSON.stringify({name:'aidd-framework',version:'5.12.0'}));
  assert.equal((await status({...options,fetcher:releases([],available)})).version, null);
  assert.equal((await status({...options,env:{...options.env,CLAUDE_PLUGIN_ROOT:path.join(native,'cache','aidd-framework','aidd-maintenance','1.0.0')},fetcher:releases([],available)})).version, '5.12.0');
});

test('a direct Claude installation uses CLAUDE_CONFIG_DIR to find its marketplace', async t => {
  const options = fixture(t);
  fs.rmSync(path.join(options.cwd, '.aidd'), {recursive:true, force:true});
  const native = path.join(options.home, 'custom-claude', 'plugins');
  const installed = path.join(options.home, 'native-marketplace');
  fs.mkdirSync(native, {recursive:true});
  fs.mkdirSync(path.join(installed, '.claude-plugin'), {recursive:true});
  fs.writeFileSync(path.join(native, 'known_marketplaces.json'), JSON.stringify({'aidd-framework':{installLocation:installed, source:{source:'directory'}}}));
  fs.writeFileSync(path.join(installed, '.claude-plugin', 'marketplace.json'), JSON.stringify({name:'aidd-framework',version:'5.12.0'}));
  const env = {...options.env, CLAUDE_CONFIG_DIR:path.dirname(native), CLAUDE_PLUGIN_ROOT:path.join(native,'cache','aidd-framework','aidd-maintenance','1.0.0')};
  assert.equal((await status({...options,env,fetcher:releases([],available)})).version, '5.12.0');
});

test('Claude uses its native marketplace when an unrelated CLI registry also exists', async t => {
  const options = fixture(t);
  const native = path.join(options.home, '.claude', 'plugins');
  const installed = path.join(options.home, 'native-marketplace');
  fs.mkdirSync(native, {recursive:true});
  fs.mkdirSync(path.join(installed, '.claude-plugin'), {recursive:true});
  fs.writeFileSync(path.join(native, 'known_marketplaces.json'), JSON.stringify({'aidd-framework':{installLocation:installed, source:{source:'directory'}}}));
  fs.writeFileSync(path.join(installed, '.claude-plugin', 'marketplace.json'), JSON.stringify({name:'aidd-framework',version:'5.13.0'}));
  const env = {...options.env,CLAUDE_PLUGIN_ROOT:path.join(native,'cache','aidd-framework','aidd-maintenance','1.0.0')};
  assert.equal((await status({...options,env,fetcher:releases([],available)})).version,'5.13.0');
  assert.equal((await status({...options,env,tool:'opencode',fetcher:releases([],available)})).version,'5.12.0');
});

test('Claude resolves a symlinked config directory before matching the native plugin', async t => {
  const options=fixture(t);
  const config=path.join(options.home,'real-claude');
  const alias=path.join(options.home,'claude-alias');
  const native=path.join(config,'plugins');
  const pluginRoot=path.join(native,'cache','aidd-framework','aidd-maintenance','1.0.0');
  const installed=path.join(options.home,'native-marketplace');
  fs.mkdirSync(pluginRoot,{recursive:true});
  fs.mkdirSync(path.join(installed,'.claude-plugin'),{recursive:true});
  fs.symlinkSync(config,alias,process.platform === 'win32' ? 'junction' : 'dir');
  fs.writeFileSync(path.join(native,'known_marketplaces.json'),JSON.stringify({'aidd-framework':{installLocation:installed,source:{source:'directory'}}}));
  fs.writeFileSync(path.join(installed,'.claude-plugin','marketplace.json'),JSON.stringify({name:'aidd-framework',version:'5.13.0'}));
  const env={...options.env,CLAUDE_CONFIG_DIR:alias,CLAUDE_PLUGIN_ROOT:pluginRoot};
  assert.equal((await status({...options,env,fetcher:releases([],available)})).version,'5.13.0');
});

test('Claude recognizes its direct local marketplace plugin outside the cache', async t => {
  const options=fixture(t);
  const native=path.join(options.home,'.claude','plugins');
  const installed=path.join(options.home,'native-marketplace');
  const pluginRoot=path.join(installed,'plugins','aidd-maintenance');
  fs.mkdirSync(native,{recursive:true});
  fs.mkdirSync(pluginRoot,{recursive:true});
  fs.mkdirSync(path.join(installed,'.claude-plugin'),{recursive:true});
  fs.writeFileSync(path.join(native,'known_marketplaces.json'),JSON.stringify({'aidd-framework':{installLocation:installed,source:{source:'directory'}}}));
  fs.writeFileSync(path.join(installed,'.claude-plugin','marketplace.json'),JSON.stringify({name:'aidd-framework',version:'5.13.0',plugins:[{name:'aidd-maintenance',source:'./plugins/aidd-maintenance'}]}));
  const env={...options.env,CLAUDE_PLUGIN_ROOT:pluginRoot};
  assert.equal((await status({...options,env,fetcher:releases([],available)})).version,'5.13.0');
});

test('Claude reports project plugins as unverified when their CLI registry is corrupt', async t => {
  const options=fixture(t);
  const native=path.join(options.home,'.claude','plugins');
  const installed=path.join(options.home,'native-marketplace');
  const pluginRoot=path.join(native,'cache','aidd-framework','aidd-maintenance','1.0.0');
  fs.mkdirSync(pluginRoot,{recursive:true});
  fs.mkdirSync(path.join(installed,'.claude-plugin'),{recursive:true});
  fs.writeFileSync(path.join(native,'known_marketplaces.json'),JSON.stringify({'aidd-framework':{installLocation:installed,source:{source:'directory'}}}));
  fs.writeFileSync(path.join(installed,'.claude-plugin','marketplace.json'),JSON.stringify({name:'aidd-framework',version:'5.13.0'}));
  fs.writeFileSync(path.join(options.cwd,'.aidd','marketplaces.json'),'{bad json');
  writeManifest(path.join(options.cwd,'.aidd','manifest.json'),{opencode:{plugins:[plugin('aidd-context','v5.12.0','2.9.0')]}});
  const text=format(await status({...options,env:{...options.env,CLAUDE_PLUGIN_ROOT:pluginRoot},fetcher:releases([],available)}));
  assert.match(text,/marketplace v5\.13\.0/i);
  assert.match(text,/plugins non vérifié/i);
  assert.doesNotMatch(text,/opencode.*aidd-context/i);
});

test('a moving branch is never compared to releases', async t => {
  const options=fixture(t,{kind:'github',repo:'ai-driven-dev/framework',ref:'next'}); const calls=[];
  const result=await status({...options,fetcher:releases(calls,available)});
  assert.equal(calls.length,0);
  assert.equal(result.hasUpdate,undefined);
  assert.match(format(result),/non épinglée.*comparaison indisponible/i);
});

test('an unpinned GitHub source is never compared to releases', async t => {
  const options=fixture(t,{kind:'github',repo:'ai-driven-dev/framework'}); const calls=[];
  const result=await status({...options,fetcher:releases(calls,available)});
  assert.equal(calls.length,0);
  assert.equal(result.hasUpdate,undefined);
  assert.match(format(result),/non épinglée.*comparaison indisponible/i);
});

test('a catalogue version inconsistent with its source tag is not compared', async t => {
  const options=fixture(t,{kind:'github',repo:'ai-driven-dev/framework',ref:'v5.11.0'},'5.12.0'); const calls=[];
  const result=await status({...options,fetcher:releases(calls,available)});
  assert.equal(calls.length,0);
  assert.equal(result.hasUpdate,undefined);
  assert.match(format(result),/incohérente.*comparaison indisponible/i);
});

test('an unknown catalogue version is not compared', async t => {
  const options=fixture(t,{kind:'github',repo:'ai-driven-dev/framework',ref:'v5.12.0'},'invalid'); const calls=[];
  const result=await status({...options,fetcher:releases(calls,available)});
  assert.equal(calls.length,0);
  assert.match(format(result),/version.*inconnue.*comparaison indisponible/i);
});

test('a Codex plugin never uses Claude marketplace data or claims the Claude skill', async t => {
  const options=fixture(t); fs.rmSync(path.join(options.cwd,'.aidd'),{recursive:true,force:true});
  const native=path.join(options.home,'.claude','plugins'); const installed=path.join(options.home,'native-marketplace');
  fs.mkdirSync(native,{recursive:true}); fs.mkdirSync(path.join(installed,'.claude-plugin'),{recursive:true});
  fs.writeFileSync(path.join(native,'known_marketplaces.json'),JSON.stringify({'aidd-framework':{installLocation:installed,source:{source:'directory'}}}));
  fs.writeFileSync(path.join(installed,'.claude-plugin','marketplace.json'),JSON.stringify({name:'aidd-framework',version:'5.12.0'}));
  const env={...options.env,CLAUDE_PLUGIN_ROOT:path.join(options.home,'.codex','plugins','cache','aidd-framework','aidd-maintenance','1.0.0')};
  assert.equal((await status({...options,env,fetcher:releases([],available)})).version,null);
  assert.doesNotMatch(format({version:'5.12.0',latest:{tag:'v5.13.0',title:'Title'},hasUpdate:true},env),/aidd-maintenance:01-update/);
});

test('the hook emits the valid native shape for each host', t => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aidd-maintenance-host-')); t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const script=path.resolve(__dirname,'../../plugins/aidd-maintenance/hooks/session-start.cjs');
  const run=input=>JSON.parse(spawnSync(process.execPath,[script],{cwd:dir,encoding:'utf8',env:{PATH:process.env.PATH,HOME:dir,AIDD_USER_CONFIG_DIR:dir},input:JSON.stringify(input)}).stdout);
  assert.deepEqual(Object.keys(run({hook_event_name:'SessionStart',model:'gpt-6.1-sol'})),['systemMessage']);
  assert.deepEqual(Object.keys(run({hook_event_name:'SessionStart',source:'startup'})),['systemMessage']);
  assert.deepEqual(Object.keys(run({sessionId:'id',timestamp:123,cwd:dir,source:'startup'})),['additionalContext']);
  assert.deepEqual(Object.keys(run({session_id:'id',is_background_agent:false})),['additional_context']);
});

test('Copilot CLI displays a progress message before its final hook context', t => {
  const options=fixture(t,{kind:'github',repo:'ai-driven-dev/framework',ref:'next'});
  const script=path.resolve(__dirname,'../../plugins/aidd-maintenance/hooks/session-start.cjs');
  const run=(input,cli)=>{
    const child=spawnSync(process.execPath,[script],{
      cwd:options.cwd, encoding:'utf8', input:JSON.stringify(input),
      env:{PATH:process.env.PATH,HOME:options.home,...options.env,...(cli?{COPILOT_CLI:'1'}:{})},
    });
    assert.equal(child.status,0,child.stderr);
    return child.stdout.split('\n').map(line=>JSON.parse(line));
  };
  const payload={sessionId:'id',timestamp:123,cwd:options.cwd,source:'startup'};
  const [progress,final]=run(payload,true);
  assert.equal(progress.type,'progress');
  assert.match(progress.message,/marketplace v5\.12\.0/);
  assert.deepEqual(final,{additionalContext:progress.message});
  assert.deepEqual(run(payload,false),[final]);
  assert.equal(run({hook_event_name:'SessionStart',source:'startup'},true).length,1);
  assert.deepEqual(Object.keys(run({session_id:'id',is_background_agent:false,timestamp:123},true)[0]),['additional_context']);
});
