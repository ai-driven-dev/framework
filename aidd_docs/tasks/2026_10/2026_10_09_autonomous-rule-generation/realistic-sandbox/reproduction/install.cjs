const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const assert = require('node:assert/strict');
const {root,repo,hosts,tools:chosenTools}=require('./common.cjs').open();
const cli = path.join(repo,'cli/dist/cli.js');
const source = path.join(repo,'plugins/aidd-context');
const records=[];
function envFor(project) {
 const home=path.join(root,'homes',path.basename(project)); fs.mkdirSync(home,{recursive:true});
 return {PATH:'/usr/bin:/bin',HOME:home,USERPROFILE:home,APPDATA:path.join(home,'AppData/Roaming'),XDG_CONFIG_HOME:path.join(home,'.config'),AIDD_USER_CONFIG_DIR:path.join(home,'.config/aidd'),CODEX_HOME:path.join(home,'.codex'),AIDD_SKIP_UPDATE_CHECK:'1'};
}
function cliRun(project,args) {
 const result=spawnSync(process.execPath,[cli,...args],{cwd:project,env:envFor(project),encoding:'utf8',timeout:60000});
 const record={project,args:[process.execPath,cli,...args],exit:result.status,stdout:result.stdout,stderr:result.stderr,error:result.error?.message}; records.push(record);
 fs.writeFileSync(path.join(root,'install-commands.json'),JSON.stringify(records,null,2));
 return record;
}
const untouched=['AGENTS.md','.claude/rules/00-architecture/0-user-boundaries.md','.cursor/rules/00-architecture/0-user-boundaries.mdc','.github/instructions/00-user-boundaries.instructions.md'];
const installations=[];
for (const host of hosts) {
 const project=path.join(root,'projects',host);
 fs.rmSync(project,{recursive:true,force:true}); fs.cpSync(path.join(root,'baseline'),project,{recursive:true});
 const before=Object.fromEntries(untouched.map(name=>[name,fs.readFileSync(path.join(project,name))]));
 const tools=host==='mixed'?chosenTools:[host];
 for(const tool of tools) {
  const runtime=cliRun(project,['framework','install','--tool',tool,'--no-plugins']);
  const installed=cliRun(project,['plugin','install',source,'--tool',tool,'--scope','project','--yes']);
  let mode='project-local-plugin-install';
  let scripts=fs.readdirSync(project,{recursive:true}).filter(name=>name.endsWith('05-rule-generate/scripts/write-rule.cjs') && name.includes('.'+(tool==='copilot'?'github':tool)));
  if(installed.exit!==0 || !scripts.length || ['cursor','codex','copilot'].includes(tool)) {
   const translated=cliRun(project,['translate',repo,'--to',tool,'--as','flat','--out',project]);
   assert.equal(translated.exit,0,JSON.stringify(translated));
   mode='project-local-flat-translation (native activation not exercised)';
   scripts=fs.readdirSync(project,{recursive:true}).filter(name=>name.endsWith('05-rule-generate/scripts/write-rule.cjs'));
  }
  const preferred=scripts.find(name=>name.startsWith(tool==='copilot'?'.github/':tool==='codex'?'.agents/':'.'+tool+'/'));
  assert.ok(preferred||scripts.length,tool+' installed script missing');
  installations.push({host,tool,project,mode,runtimeExit:runtime.exit,pluginInstallExit:installed.exit,script:path.join(project,preferred||scripts[0])});
 }
 for(const name of untouched) assert.deepEqual(fs.readFileSync(path.join(project,name)),before[name],host+' preserves '+name);
}
fs.writeFileSync(path.join(root,'installations.json'),JSON.stringify(installations,null,2));
console.log(JSON.stringify({projects:hosts.length,installedScripts:installations.length,evidence:path.join(root,'installations.json')}));
