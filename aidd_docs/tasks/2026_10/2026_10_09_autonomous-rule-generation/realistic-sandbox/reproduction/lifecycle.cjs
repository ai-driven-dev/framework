const fs=require('node:fs'); const path=require('node:path'); const assert=require('node:assert/strict'); const {spawnSync}=require('node:child_process'); const {createHash}=require('node:crypto');
const {root,repo,hosts,tools:chosenTools}=require('./common.cjs').open(); const installations=JSON.parse(fs.readFileSync(path.join(root,'installations.json'),'utf8'));
const tools=['claude','cursor','copilot','codex','opencode'];
const nativeUser=['.claude/rules/00-architecture/0-user-boundaries.md','.cursor/rules/00-architecture/0-user-boundaries.mdc','.github/instructions/00-user-boundaries.instructions.md'];
const rules=[
 {category:'07-quality',slug:'7-monetary-precision',description:'Invoice precision across the codebase',paths:[],body:'# Monetary precision\n\n- Accept money as integer cents.\n- Reject unsafe integer totals.\n'},
 {category:'02-programming-languages',slug:'2-domain-invariants',description:'TypeScript invoice domain invariants',paths:['src/domain/**/*.ts'],body:'# Invoice aggregate construction\n\n- Validate before allocating invoice identities.\n- Return detached repository snapshots.\n'},
 {category:'09-other',slug:'9-api-documentation',description:'Invoice API documentation',paths:['docs/**/*.md'],body:'# API documentation\n\n- Describe errors using HTTP status codes.\n- Document process-local persistence limits.\n'}
];
const records=[]; const results=[]; fs.mkdirSync(path.join(root,'requests'),{recursive:true});
function snapshot(project) {const result={}; for(const name of fs.readdirSync(project,{recursive:true})) {const file=path.join(project,name); const stat=fs.lstatSync(file); if(stat.isFile()) result[name]=fs.readFileSync(file).toString('base64'); else if(stat.isSymbolicLink()) result[name]='symlink:'+fs.readlinkSync(file);} return result;}
function run(entry, selected, request, args=[]) {
 const input=path.join(root,'requests',entry.host+'-'+records.length+'.json'); fs.writeFileSync(input,JSON.stringify(request));
 const argv=[entry.script,'--project',entry.project,'--tools',selected.join(','),...(args.length?args:['--input',input])];
 const result=spawnSync(process.execPath,argv,{cwd:path.join(root,'requests'),env:{PATH:''},encoding:'utf8',timeout:30000});
 records.push({host:entry.host,args:[process.execPath,...argv],exit:result.status,stdout:result.stdout,stderr:result.stderr});
 assert.equal(result.status,0,JSON.stringify(records.at(-1))); return result;
}
for(const host of hosts) {
 const entry=installations.find(entry=>entry.host===host);
 const selected=host==='mixed'?tools:[host];
 const originalAgents=fs.readFileSync(path.join(entry.project,'AGENTS.md'));
 const originals=Object.fromEntries(nativeUser.map(name=>[name,fs.readFileSync(path.join(entry.project,name))]));
 for(const rule of rules) run(entry,selected,rule);
 const beforeRerun=snapshot(entry.project); for(const rule of rules) run(entry,selected,rule); assert.deepEqual(snapshot(entry.project),beforeRerun);
 if(selected.some(tool=>tool==='codex'||tool==='opencode')) {
  const agents=fs.readFileSync(path.join(entry.project,'AGENTS.md'),'utf8');
  for(const rule of rules) assert.equal(agents.split(rule.body).length,2,'one complete body for '+rule.slug);
 }
 const canonical=path.join(entry.project,'aidd_docs/rules/02-programming-languages/2-domain-invariants.md');
 fs.appendFileSync(canonical,'- Keep validation failures free of storage writes.\n');
 run(entry,selected,null,['--publish']);
 const published=snapshot(entry.project); run(entry,selected,null,['--publish']); assert.deepEqual(snapshot(entry.project),published);
 const retarget=host==='mixed'?['codex']:[host==='opencode'?'claude':'opencode'];
 run(entry,retarget,rules[2]); run(entry,selected,rules[2]);
 run(entry,selected,null,['--delete','09-other/9-api-documentation']);
 assert.ok(!fs.existsSync(path.join(entry.project,'aidd_docs/rules/09-other/9-api-documentation.md')));
 run(entry,selected,null,['--delete','02-programming-languages/2-domain-invariants']);
 run(entry,selected,null,['--delete','07-quality/7-monetary-precision']);
 assert.deepEqual(fs.readFileSync(path.join(entry.project,'AGENTS.md')),originalAgents);
 for(const name of nativeUser) assert.deepEqual(fs.readFileSync(path.join(entry.project,name)),originals[name]);
 const app=spawnSync(process.execPath,['--test','tests/invoice.test.ts','tests/http.test.ts'],{cwd:entry.project,encoding:'utf8'}); assert.equal(app.status,0,app.stdout+app.stderr);
 results.push({host,steps:13,tests:9,originalAgentsSha256:createHash('sha256').update(originalAgents).digest('hex'),userNativePreserved:true,lastDeleteRestoredOriginalAgents:true});
}
fs.writeFileSync(path.join(root,'lifecycle-commands.json'),JSON.stringify(records,null,2));
fs.writeFileSync(path.join(root,'lifecycle-results.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify({projects:results.length,installedInvocations:records.length,allUserBytesPreserved:true,applicationTests:results.length*9,evidence:path.join(root,'lifecycle-results.json')}));
