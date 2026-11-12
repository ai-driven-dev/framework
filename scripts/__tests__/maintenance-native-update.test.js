const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {updateNative} = require('../../plugins/aidd-maintenance/hooks/update-native.cjs');
const {readNativeConfig} = require('../../plugins/aidd-maintenance/hooks/lib/native-config.cjs');
const {inspectInventory} = require('../../plugins/aidd-maintenance/hooks/lib/inventory.cjs');

const repo = 'ai-driven-dev/framework';
const current = 'v5.12.0';
const release = 'v5.13.0';
const versions = {'.':'5.13.0', 'plugins/aidd-context':'2.10.0', 'plugins/aidd-dev':'2.8.0'};
const commit = 'a'.repeat(40);

function fixture(t, tool = 'claude', scope = tool === 'claude' ? 'project' : 'user') {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'maintenance-native-'));
  t.after(() => fs.rmSync(home, {recursive:true,force:true}));
  const cwd = path.join(home,'project');
  const host = path.join(home,`.${tool}`);
  fs.mkdirSync(cwd);
  fs.mkdirSync(host);
  const config = path.join(host,tool === 'codex' ? 'config.toml' : 'settings.json');
  const text = tool === 'codex'
    ? `# Keep this comment\nmodel = 'custom-model'\n[marketplaces."aidd-framework"]\nsource_type = 'git'\nsource = 'https://github.com/${repo}.git'\nref = '${current}' # Only this value changes\n[plugins."aidd-context@aidd-framework"]\nenabled = false\n`
    : `{// Keep this comment\n"extraKnownMarketplaces":{"aidd-framework":{"source":{"source":"github","repo":"${repo}","ref":"${current}",},},},\n"enabledPlugins":{"aidd-context@aidd-framework":false},\n"theme":"dark", "releaseHint":"${current}" /* unrelated value */\n}\n`;
  fs.writeFileSync(config,text,{mode:0o600});
  const entry = (name, installedScope, version, enabled) => ({
    manager:'native',tool,scope:installedScope,name,ref:`${name}@aidd-framework`,version,enabled,
    source:{kind:'github',repo,ref:current},
    ...(installedScope === 'local' ? {projectPath:fs.realpathSync(cwd)} : {}),
  });
  const state = {installations:[
    entry('aidd-context',scope === 'project' ? 'local' : 'user','2.9.0',false),
    entry('aidd-dev','user','2.7.0',true),
  ],warnings:[]};
  const calls = [];
  const fetcher = async url => {
    let data;
    if (url.endsWith(`/releases/tags/${release}`)) data = {tag_name:release,draft:false,name:'Release title'};
    else if (url.endsWith(`/commits/${release}`)) data = {sha:commit};
    else if (url.endsWith(`/${commit}/.release-please-manifest.json`)) data = versions;
    else if (url.endsWith(`/${release}/release-video.json`)) data = {title:'Descriptive release title'};
    else throw new Error(`Unexpected request: ${url}`);
    return {ok:true,json:async()=>structuredClone(data)};
  };
  const run = async (binary,args,options) => {
    calls.push({binary,args,cwd:options.cwd});
    if (args[1] === 'marketplace') {
      for (const installed of state.installations) {
        installed.source.ref = release;
        if (tool === 'codex') installed.version = versions[`plugins/${installed.name}`];
      }
    } else {
      const targetScope = args.includes('--scope') ? args[args.indexOf('--scope')+1] : 'user';
      for (const installed of state.installations) {
        if (installed.ref === args[2] && installed.scope === targetScope)
          installed.version = versions[`plugins/${installed.name}`];
      }
    }
  };
  const options = {tool,scope,release,cwd,home,env:{},fetcher,inspect:async()=>structuredClone(state),run};
  return {options,state,calls,config,text,run};
}

async function approved(f, overrides = {}) {
  const preview = await updateNative(f.options);
  return updateNative({...f.options,approve:preview.approval,...overrides});
}

test('preview reads the target and all affected scopes without writing configuration or invoking a host', async t => {
  const f = fixture(t);
  const result = await updateNative(f.options);
  assert.equal(result.status,'preview');
  assert.equal(result.commit,commit);
  assert.equal(result.title,'Descriptive release title');
  assert.equal(result.impact.length,2);
  assert.deepEqual(result.updates.map(item=>[item.ref,item.scope]),[['aidd-context@aidd-framework','local']]);
  assert.equal(fs.readFileSync(f.config,'utf8'),f.text);
  assert.deepEqual(f.calls,[]);
  assert.deepEqual(fs.readdirSync(path.dirname(f.config)),['settings.json']);
});

for (const mutation of ['source ref','other config','enabled state','installed inventory']) {
  test(`an approval cannot be reused after a change to ${mutation}`, async t => {
    const f = fixture(t);
    const preview = await updateNative(f.options);
    if (mutation === 'source ref') {
      fs.writeFileSync(f.config,f.text.replace('"ref":"v5.12.0"','"ref":"v5.12.1"'));
      for (const entry of f.state.installations) entry.source.ref = 'v5.12.1';
    } else if (mutation === 'other config') fs.writeFileSync(f.config,f.text.replace('"dark"','"light"'));
    else if (mutation === 'enabled state') f.state.installations[0].enabled = true;
    else f.state.installations.pop();
    const before = fs.readFileSync(f.config,'utf8');
    await assert.rejects(updateNative({...f.options,approve:preview.approval}));
    assert.equal(fs.readFileSync(f.config,'utf8'),before);
    assert.deepEqual(f.calls,[]);
  });
}

test('an approval is invalidated when its release tag resolves to another commit', async t => {
  const f = fixture(t);
  const preview = await updateNative(f.options);
  const moved = 'b'.repeat(40);
  const fetcher = async url => url.endsWith(`/commits/${release}`)
    ? {ok:true,json:async()=>({sha:moved})}
    : f.options.fetcher(url.replace(`/${moved}/`,`/${commit}/`));
  await assert.rejects(updateNative({...f.options,fetcher,approve:preview.approval}));
  assert.equal(fs.readFileSync(f.config,'utf8'),f.text);
  assert.deepEqual(f.calls,[]);
});

for (const tool of ['claude','codex','copilot']) {
  test(`${tool} updates with native commands while preserving unrelated bytes, permissions and disabled plugins`, async t => {
    const f = fixture(t,tool);
    const initial = structuredClone(f.state.installations);
    const result = await approved(f);
    assert.equal(result.status,'updated');
    const expected = tool === 'codex'
      ? f.text.replace(`ref = '${current}'`,`ref = "${release}"`)
      : f.text.replace(`"ref":"${current}"`,`"ref":"${release}"`);
    assert.equal(fs.readFileSync(f.config,'utf8'),expected);
    assert.equal(fs.statSync(f.config).mode & 0o777,0o600);
    assert.deepEqual(f.state.installations.map(item=>item.enabled),initial.map(item=>item.enabled));
    const commands = tool === 'claude'
      ? [['plugin','marketplace','add',`${repo}#${release}`,'--scope','user'],['plugin','update','aidd-context@aidd-framework','--scope','local']]
      : tool === 'codex'
        ? [['plugin','marketplace','upgrade','aidd-framework','--json']]
        : [['plugin','marketplace','update','aidd-framework'],['plugin','update','aidd-context@aidd-framework'],['plugin','update','aidd-dev@aidd-framework']];
    assert.deepEqual(f.calls,commands.map(args=>({binary:tool,args,cwd:f.options.cwd})));
    if (tool === 'claude') assert.equal(f.state.installations[1].version,'2.7.0');
    assert.deepEqual(fs.readdirSync(path.dirname(f.config)),[path.basename(f.config)]);
  });
}

test('a native failure reports partial state and executes no retry or subsequent plugin command', async t => {
  const f = fixture(t,'copilot');
  const run = async (...args) => {
    await f.run(...args);
    if (f.calls.length === 2) throw new Error('Host unavailable');
  };
  await assert.rejects(approved(f,{run}),/incomplete/);
  assert.equal(f.calls.length,2);
  assert.equal(readNativeConfig('copilot',f.options).source.ref,release);
  assert.equal(f.state.installations[1].version,'2.7.0');
  assert.equal(fs.existsSync(`${f.config}.aidd-update.lock`),false);
});

test('atomic replacement preserves an existing Unix mode even under a stricter umask', {skip:process.platform === 'win32'}, async t => {
  const f = fixture(t);
  fs.chmodSync(f.config,0o640);
  const mask = process.umask(0o077);
  try {
    await approved(f);
    assert.equal(fs.statSync(f.config).mode & 0o777,0o640);
  } finally { process.umask(mask); }
});

for (const policy of ['managed','restricted']) {
  test(`an unrestricted marketplace does not erase a plugin's ${policy} restriction`, async t => {
    const f = fixture(t);
    const runner = async (_tool,args) => args[1] === 'marketplace'
      ? [{name:'aidd-framework',source:'github',repo,[policy]:false}]
      : f.state.installations.map((entry,index)=>({...entry,id:entry.ref,[policy]:index === 0}));
    const inspect = options => inspectInventory({...options,runner});
    await assert.rejects(updateNative({...f.options,inspect}));
    assert.equal(fs.readFileSync(f.config,'utf8'),f.text);
    assert.deepEqual(f.calls,[]);
  });
}

test('a host that re-enables a disabled plugin cannot be reported as successfully updated', async t => {
  const f = fixture(t);
  const run = async (...args) => {
    await f.run(...args);
    f.state.installations[0].enabled = true;
  };
  await assert.rejects(approved(f,{run}),/incomplete/);
  assert.equal(f.calls.length,2);
});

for (const defect of ['managed','restricted','unknown enabled','unknown version','unknown source','incomplete inventory']) {
  test(`refuses ${defect} before writing or invoking a native command`, async t => {
    const f = fixture(t);
    const target = f.state.installations[0];
    if (defect === 'managed') target.managed = true;
    else if (defect === 'restricted') target.restricted = true;
    else if (defect === 'unknown enabled') target.enabled = null;
    else if (defect === 'unknown version') target.version = null;
    else if (defect === 'unknown source') target.source = {kind:'unknown'};
    else f.state.warnings.push({tool:'claude',code:'native-unavailable'});
    await assert.rejects(updateNative(f.options));
    assert.equal(fs.readFileSync(f.config,'utf8'),f.text);
    assert.deepEqual(f.calls,[]);
  });
}

test('refuses multiple editable Claude marketplace sources', async t => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.options.cwd,'.claude'));
  fs.writeFileSync(path.join(f.options.cwd,'.claude','settings.json'),f.text);
  await assert.rejects(updateNative(f.options));
  assert.equal(fs.readFileSync(f.config,'utf8'),f.text);
  assert.deepEqual(f.calls,[]);
});

test('duplicate JSONC source keys remain untouched instead of choosing a reference', t => {
  const f = fixture(t);
  const text = f.text.replace('"ref":"v5.12.0"','"ref":"v5.12.0", "ref":"v5.13.0"');
  fs.writeFileSync(f.config,text);
  assert.throws(()=>readNativeConfig('claude',f.options));
  assert.equal(fs.readFileSync(f.config,'utf8'),text);
});

test('Codex rejects alternative marketplace table encodings alongside a recognized source', t => {
  const f = fixture(t,'codex');
  const text = `${f.text}\n["marketplaces"."aidd-framework"]\nref = "v5.13.0"\n`;
  fs.writeFileSync(f.config,text);
  assert.throws(()=>readNativeConfig('codex',f.options));
  assert.equal(fs.readFileSync(f.config,'utf8'),text);
});

test('rejects project scope on a machine-scoped native host', async t => {
  const f = fixture(t,'codex');
  await assert.rejects(updateNative({...f.options,scope:'project'}));
  assert.equal(fs.readFileSync(f.config,'utf8'),f.text);
  assert.deepEqual(f.calls,[]);
});

test('refuses a symlinked config without changing its target', async t => {
  const f = fixture(t);
  const target = path.join(f.options.home,'user-settings.json');
  fs.renameSync(f.config,target);
  fs.symlinkSync(target,f.config);
  await assert.rejects(approved(f));
  assert.equal(fs.readFileSync(target,'utf8'),f.text);
  assert.deepEqual(f.calls,[]);
});

test('a configuration edited during approval checks is preserved before native execution', async t => {
  const f = fixture(t);
  const preview = await updateNative(f.options);
  const changed = `${f.text}// Concurrent edit\n`;
  const fetcher = async (...args) => {
    fs.writeFileSync(f.config,changed);
    return f.options.fetcher(...args);
  };
  await assert.rejects(updateNative({...f.options,fetcher,approve:preview.approval}));
  assert.equal(fs.readFileSync(f.config,'utf8'),changed);
  assert.deepEqual(f.calls,[]);
  assert.equal(fs.existsSync(`${f.config}.aidd-update.lock`),false);
});

test('an incomplete catalogue refresh requires a new preview and approval before recovery', async t => {
  const f = fixture(t,'codex');
  const original = await updateNative(f.options);
  const failedRefresh = async (binary,args,options) => {
    f.calls.push({binary,args,cwd:options.cwd});
    for (const entry of f.state.installations) entry.source.ref = null;
    f.state.warnings.push({tool:'codex',code:'native-catalogue-source-mismatch'});
    throw new Error('Native refresh failed');
  };
  await assert.rejects(updateNative({...f.options,approve:original.approval,run:failedRefresh}),/incomplete/);
  assert.equal(readNativeConfig('codex',f.options).source.ref,release);
  assert.equal(f.calls.length,1);
  await assert.rejects(updateNative({...f.options,approve:original.approval}));
  assert.equal(f.calls.length,1);

  f.state.warnings.push({tool:'codex',code:'native-unavailable'});
  await assert.rejects(updateNative(f.options));
  f.state.warnings.pop();
  const recovery = await updateNative(f.options);
  assert.equal(recovery.status,'preview');
  assert.equal(typeof recovery.recovery,'string');
  assert.notEqual(recovery.approval,original.approval);
  assert.equal(f.calls.length,1);
  const run = async (...args) => { await f.run(...args); f.state.warnings = []; };
  const result = await updateNative({...f.options,approve:recovery.approval,run});
  assert.equal(result.status,'updated');
  assert.equal(f.calls.length,2);
  assert.equal(f.state.installations[0].version,'2.10.0');
  assert.equal(f.state.installations[0].enabled,false);
});

test('a plugin changed during release lookup is detected before any config write or native command', async t => {
  const f = fixture(t);
  const preview = await updateNative(f.options);
  const fetcher = async (...args) => {
    f.state.installations[0].enabled = true;
    return f.options.fetcher(...args);
  };
  await assert.rejects(updateNative({...f.options,approve:preview.approval,fetcher}));
  assert.equal(fs.readFileSync(f.config,'utf8'),f.text);
  assert.equal(f.state.installations[0].enabled,true);
  assert.deepEqual(f.calls,[]);
  assert.equal(fs.existsSync(`${f.config}.aidd-update.lock`),false);
});
