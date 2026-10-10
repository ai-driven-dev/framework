const fs=require('node:fs'); const path=require('node:path'); const assert=require('node:assert/strict'); const {spawnSync}=require('node:child_process');
const {root,repo,hosts,tools:chosenTools}=require('./common.cjs').open();
const installed=JSON.parse(fs.readFileSync(path.join(root,'installations.json'),'utf8')).find(entry=>entry.host==='opencode');
const project=path.join(root,'cleanup-project'); fs.rmSync(project,{recursive:true,force:true}); fs.cpSync(installed.project,project,{recursive:true});
const script=installed.script.replace(installed.project,project); const home=path.join(root,'homes','cleanup'); fs.mkdirSync(home,{recursive:true});
const env={PATH:'/usr/bin:/bin',HOME:home,USERPROFILE:home,APPDATA:path.join(home,'AppData/Roaming'),XDG_CONFIG_HOME:path.join(home,'.config'),AIDD_USER_CONFIG_DIR:path.join(home,'.config/aidd'),CODEX_HOME:path.join(home,'.codex'),AIDD_SKIP_UPDATE_CHECK:'1'};
const records=[];
const request={category:'02-programming-languages',slug:'2-invoice-boundary',description:'Invoice domain boundary',paths:['src/domain/**/*.ts'],body:'- Validate invoice totals before persistence.\n'};
const input=path.join(root,'cleanup-input.json'); fs.writeFileSync(input,JSON.stringify(request));
const generated=spawnSync(process.execPath,[script,'--project',project,'--tools','opencode','--input',input],{cwd:project,env:{PATH:''},encoding:'utf8'}); assert.equal(generated.status,0,generated.stderr);
const protectedFiles=['AGENTS.md','aidd_docs/rules/02-programming-languages/2-invoice-boundary.md','src/domain/invoice.ts','src/http/app.ts','docs/api.md','.claude/rules/00-architecture/0-user-boundaries.md','.cursor/rules/00-architecture/0-user-boundaries.mdc','.github/instructions/00-user-boundaries.instructions.md'];
const original=protectedFiles.map(name=>fs.readFileSync(path.join(project,name)));
for(const args of [['doctor','--tool','opencode','--plugin','aidd-context'],['sync','--tool','opencode','--plugin','aidd-context','--force'],['doctor','--tool','opencode','--plugin','aidd-context'],['plugin','remove','aidd-context','--tool','opencode','--scope','project'],['doctor','--tool','opencode']]) {
 const result=spawnSync(process.execPath,[path.join(repo,'cli/dist/cli.js'),...args],{cwd:project,env,encoding:'utf8',timeout:60000});
 records.push({args:[process.execPath,path.join(repo,'cli/dist/cli.js'),...args],exit:result.status,stdout:result.stdout,stderr:result.stderr});
 assert.equal(result.status,0,result.error?.message || result.stderr || args.join(' ')+' failed');
 for(let i=0;i<protectedFiles.length;i++) assert.deepEqual(fs.readFileSync(path.join(project,protectedFiles[i])),original[i],args.join(' ')+' preserves '+protectedFiles[i]);
}
assert.equal(fs.existsSync(script),false,'Plugin removal left the installed script');
const result={generatedRulesUnownedAndPreserved:true,protectedFiles,installedPluginScriptRemoved:!fs.existsSync(script),commands:records};
fs.writeFileSync(path.join(root,'cleanup-results.json'),JSON.stringify(result,null,2)); console.log(JSON.stringify({generatedRulesPreserved:true,scriptRemoved:result.installedPluginScriptRemoved,exits:records.map(record=>record.exit),evidence:path.join(root,'cleanup-results.json')}));
