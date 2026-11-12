const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {inspectInventory}=require('../../plugins/aidd-maintenance/hooks/lib/inventory.cjs');
const {status,format}=require('../../plugins/aidd-maintenance/hooks/session-start.cjs');

function fixture(t) {
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'maintenance-inventory-'));
  t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
  const cwd=path.join(home,'project'); fs.mkdirSync(cwd);
  const root=path.join(home,'marketplace'); fs.mkdirSync(path.join(root,'.claude-plugin'),{recursive:true});
  fs.writeFileSync(path.join(root,'.claude-plugin','marketplace.json'),JSON.stringify({name:'aidd-framework',version:'5.12.0'}));
  return {home,cwd,root,env:{AIDD_USER_CONFIG_DIR:path.join(home,'aidd')}};
}

const source={kind:'github',repo:'ai-driven-dev/framework',ref:'v5.12.0'};
const sourceReader=()=>({path:'/isolated/config',scope:'user',source,text:'not for output'});
function nativeRunner(options,tool='codex',overrides={}) {
  const row=tool==='codex'
    ? {name:'aidd-framework',root:options.root,marketplaceSource:{sourceType:'git',source:'https://github.com/ai-driven-dev/framework.git'}}
    : tool==='copilot' ? {name:'aidd-framework',source:'GitHub: ai-driven-dev/framework'}
    : {name:'aidd-framework',source:'github',repo:'ai-driven-dev/framework',installLocation:options.root};
  const plugin={name:'aidd-context',pluginId:'aidd-context@aidd-framework',id:'aidd-context@aidd-framework',
    marketplace:'aidd-framework',scope:'user',version:'2.9.0',enabled:false};
  return async (host,args)=>{
    assert.equal(host,tool);
    if(args.includes('marketplace')) return tool==='codex' ? {marketplaces:[row]} : [row];
    const plugins=overrides.plugins || [plugin];
    return tool==='codex' ? {installed:plugins,available:[]} : plugins;
  };
}
function fetcher(url) {
  if(url.includes('/releases?')) return Promise.resolve({ok:true,json:async()=>[{tag_name:'v5.13.0',name:'The release title',draft:false,prerelease:false}]});
  if(url.includes('.release-please-manifest.json')) return Promise.resolve({ok:true,json:async()=>({'.':'5.13.0','plugins/aidd-context':'2.10.0'})});
  throw new Error('Unexpected release request');
}

for(const tool of ['codex','copilot','claude']) test(`${tool} discovers native plugin updates without an AIDD manifest`,async t=>{
  const options=fixture(t);
  const result=await status({...options,tool,runner:nativeRunner(options,tool),sourceReader,fetcher});
  assert.equal(result.inventory.installations[0].ref,'aidd-context@aidd-framework');
  assert.equal(result.inventory.installations[0].enabled,false);
  assert.equal(result.inventory.installations[0].source.ref,'v5.12.0');
  assert.equal(result.pluginUpdates[0].targetVersion,'2.10.0');
  assert.equal(result.releases[0].title,'The release title');
  assert.match(format(result),/2\.9\.0 → 2\.10\.0/);
  assert.equal(result.nativePluginsUnverified,false);
});

test('native Codex uses its own source even when an unrelated AIDD catalogue exists',async t=>{
  const options=fixture(t); fs.mkdirSync(path.join(options.cwd,'.aidd'));
  fs.writeFileSync(path.join(options.cwd,'.aidd','marketplaces.json'),JSON.stringify({marketplaces:[{name:'aidd-framework',version:'99.0.0',source:{kind:'github',repo:'unrelated/repo',ref:'v99.0.0'}}]}));
  const result=await status({...options,tool:'codex',runner:nativeRunner(options),sourceReader,fetcher});
  assert.equal(result.version,'5.12.0');
  assert.equal(result.latest.tag,'v5.13.0');
  assert.equal(result.inventory.catalogues.length,2);
  assert.equal(result.inventory.installations[0].source.repo,'ai-driven-dev/framework');
});

test('a native config cannot supply a ref for a different effective CLI source',async t=>{
  const options=fixture(t);
  const result=await status({...options,tool:'codex',runner:nativeRunner(options),sourceReader:()=>({path:'/config',source:{...source,repo:'other/repo'}}),fetcher:()=>{throw new Error('must not compare');}});
  assert.equal(result.latest,null);
  assert.deepEqual(result.pluginUpdates,[]);
  assert.equal(result.inventory.installations[0].source.ref,null);
  assert.equal(result.nativePluginsUnverified,true);
});

test('native inspection reads the pinned ref from its targeted config without exposing that config',async t=>{
  const options=fixture(t); const dir=path.join(options.home,'.codex');fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir,'config.toml'),'# retained\n[marketplaces.aidd-framework]\nsource_type = "git"\nsource = "https://github.com/ai-driven-dev/framework.git"\nref = "v5.12.0"\n');
  const result=await inspectInventory({...options,tool:'codex',runner:nativeRunner(options)});
  assert.equal(result.installations[0].source.ref,'v5.12.0');
  assert.equal(result.installations[0].sourceConfig,path.join(dir,'config.toml'));
  assert.equal(result.catalogues[0].scope,'user');
  assert.doesNotMatch(JSON.stringify(result),/# retained/);
});

test('a changed native ref with an old catalogue is reported as inconsistent',async t=>{
  const options=fixture(t);
  const result=await status({...options,tool:'codex',runner:nativeRunner(options),
    sourceReader:()=>({path:'/config',scope:'user',source:{...source,ref:'v5.13.0'}}),fetcher:()=>{throw new Error('must not compare');}});
  assert.equal(result.latest,null);
  assert.deepEqual(result.pluginUpdates,[]);
  assert.ok(result.inventory.warnings.some(warning=>warning.code==='native-catalogue-source-mismatch'));
});

test('Claude inventory preserves disabled plugins and other projects for the shared impact',async t=>{
  const options=fixture(t);
  const plugins=[
    {id:'aidd-context@aidd-framework',version:'2.9.0',enabled:false,scope:'local',projectPath:options.cwd},
    {id:'aidd-dev@aidd-framework',version:'2.6.0',enabled:true,scope:'project',projectPath:path.join(options.home,'other'),managed:true},
  ];
  const inventory=await inspectInventory({...options,tool:'claude',runner:nativeRunner(options,'claude',{plugins}),sourceReader});
  assert.equal(inventory.installations.length,2);
  assert.equal(inventory.installations[0].currentProject,true);
  assert.equal(inventory.installations[0].enabled,false);
  assert.equal(inventory.installations[1].currentProject,false);
  assert.equal(inventory.installations[1].managed,true);
});

test('native failure preserves independently recorded AIDD installations',async t=>{
  const options=fixture(t); fs.mkdirSync(path.join(options.cwd,'.aidd'));
  fs.writeFileSync(path.join(options.cwd,'.aidd','marketplaces.json'),JSON.stringify({marketplaces:[{name:'aidd-framework',version:'5.12.0',source}]}));
  fs.writeFileSync(path.join(options.cwd,'.aidd','manifest.json'),JSON.stringify({version:8,tools:{codex:{plugins:[{name:'aidd-context',scope:'project',marketplace:'aidd-framework',version:'2.9.0',source:{kind:'git-subdir',url:'https://github.com/ai-driven-dev/framework.git',path:'plugins/aidd-context',ref:'v5.12.0'}}]}}}));
  const result=await status({...options,tool:'codex',runner:async()=>{throw new Error('secret native error');},fetcher});
  assert.equal(result.pluginUpdates.length,1);
  assert.equal(result.inventory.installations[0].manager,'aidd');
  assert.equal(result.nativePluginsUnverified,true);
  assert.doesNotMatch(JSON.stringify(result),/secret native error/);
  fs.mkdirSync(path.join(options.home,'.codex'));
  fs.writeFileSync(path.join(options.home,'.codex','config.toml'),'[marketplaces.aidd-framework]\nsource_type = "git"\nsource = "https://github.com/another/repo.git"\n');
  const failedNative=await status({...options,tool:'codex',runner:async()=>{throw new Error('unavailable');},fetcher});
  assert.equal(failedNative.version,null,'an unreadable native installation must not be attributed the AIDD catalogue version');
  assert.equal(failedNative.inventory.installations[0].manager,'aidd');
});

test('inspection returns only declared fields, never native settings or arbitrary command output',async t=>{
  const options=fixture(t);
  const runner=async (_tool,args)=>args.includes('marketplace')
    ? {marketplaces:[{name:'aidd-framework',root:options.root,marketplaceSource:{sourceType:'git',source:'https://token-secret@github.com/ai-driven-dev/framework.git'},secret:'hidden'}]}
    : {installed:[{pluginId:'aidd-context@aidd-framework',version:'2.9.0',enabled:true,secret:'hidden'}]};
  const result=await inspectInventory({...options,tool:'codex',runner,sourceReader});
  assert.equal(result.installations[0].source.kind,'unknown');
  assert.doesNotMatch(JSON.stringify(result),/token-secret|hidden|not for output/);
});

test('standalone --json does not read stdin or require the AIDD CLI',t=>{
  const options=fixture(t);
  const script=path.resolve(__dirname,'../../plugins/aidd-maintenance/hooks/session-start.cjs');
  const result=spawnSync(process.execPath,[script,'--json'],{cwd:options.cwd,env:{HOME:options.home,...options.env},encoding:'utf8',timeout:3000});
  assert.equal(result.status,0,result.stderr);
  const output=JSON.parse(result.stdout);
  assert.deepEqual(output.inventory.installations,[]);
  assert.deepEqual(output.inventory.warnings,[]);
});
