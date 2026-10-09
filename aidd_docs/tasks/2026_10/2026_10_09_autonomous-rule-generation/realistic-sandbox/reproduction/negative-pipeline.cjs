const fs=require('node:fs'); const path=require('node:path'); const assert=require('node:assert/strict'); const {spawnSync}=require('node:child_process'); const {createHash}=require('node:crypto');
const {root,repo,hosts,tools:chosenTools}=require('./common.cjs').open(); const installation=JSON.parse(fs.readFileSync(path.join(root,'installations.json'),'utf8')).find(entry=>entry.host==='mixed');
const seed=path.join(root,'negative-seed'); fs.rmSync(seed,{recursive:true,force:true}); fs.cpSync(installation.project,seed,{recursive:true});
const relativeScript=path.relative(installation.project,installation.script); const selected='claude,cursor,copilot,codex,opencode';
const rules=[{category:'07-quality',slug:'7-monetary-precision',description:'Invoice precision',paths:[],body:'- Reject unsafe integer cents.\n'},{category:'02-programming-languages',slug:'2-domain-invariants',description:'Invoice domain',paths:['src/domain/**/*.ts'],body:'- Return detached repository snapshots.\n'},{category:'09-other',slug:'9-api-documentation',description:'Invoice API documentation',paths:['docs/**/*.md'],body:'- Document process-local persistence limits.\n'}];
const log=[];
function invoke(project,input,args=[]) {
 const staged=path.join(root,'negative-input.json'); fs.writeFileSync(staged,Buffer.isBuffer(input)?input:JSON.stringify(input));
 const argv=[path.join(project,relativeScript),'--project',project,'--tools',selected,...(args.length?args:['--input',staged])];
 const result=spawnSync(process.execPath,argv,{cwd:root,env:{PATH:''},encoding:'utf8'}); log.push({args:[process.execPath,...argv],exit:result.status,stdout:result.stdout,stderr:result.stderr}); return result;
}
for(const rule of rules) assert.equal(invoke(seed,rule).status,0);
function snapshot(project) {const output={}; for(const name of fs.readdirSync(project,{recursive:true})) {const file=path.join(project,name); const stat=fs.lstatSync(file); if(stat.isFile()) output[name]=createHash('sha256').update(fs.readFileSync(file)).digest('hex'); else if(stat.isSymbolicLink()) output[name]='symlink:'+fs.readlinkSync(file);} return output;}
const cases=[
 ['edited native third source', project=>{const file=path.join(project,'.cursor/rules/09-other/9-api-documentation.mdc'); fs.appendFileSync(file,'User edit\n');}],
 ['duplicate shared block',project=>{const file=path.join(project,'AGENTS.md'); fs.appendFileSync(file,fs.readFileSync(file));}],
 ['incomplete shared block',project=>{const file=path.join(project,'AGENTS.md'); fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace('<!-- aidd_rules:end -->',''));}],
 ['symlink generated target',project=>{const file=path.join(project,'.github/instructions/09-api-documentation.instructions.md'); const outside=path.join(root,'outside-native.md'); fs.writeFileSync(outside,'External user instructions\n'); fs.rmSync(file); fs.symlinkSync(outside,file);}],
 ['symlink canonical source',project=>{const file=path.join(project,'aidd_docs/rules/09-other/9-api-documentation.md'); const outside=path.join(root,'outside-canonical.md'); fs.writeFileSync(outside,fs.readFileSync(file)); fs.rmSync(file); fs.symlinkSync(outside,file);}],
 ['Codex root override',project=>fs.writeFileSync(path.join(project,'AGENTS.override.md'),'Override user instructions\n')],
 ['Codex local limit',()=>{}, {...rules[0],body:'- Large invoice guidance.\n'.repeat(1700)}],
 ['malformed staged JSON',()=>{},Buffer.from('{')],
 ['invalid UTF8 staged JSON',()=>{},Buffer.concat([Buffer.from('{"category":"07-quality","slug":"7-monetary-precision","description":"Invoice precision","body":"'),Buffer.from([255]),Buffer.from('"}')])],
 ['lone surrogate metadata',()=>{}, {...rules[1],description:'Invalid \ud800 description'}],
 ['edited separator multi-source delete',project=>{const file=path.join(project,'AGENTS.md'); fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace('separator=0 -->','separator=1 -->'));},null,['--delete','09-other/9-api-documentation']],
 ['unsafe manual canonical publish',project=>fs.appendFileSync(path.join(project,'aidd_docs/rules/09-other/9-api-documentation.md'),'<!-- aidd_rules:end -->\n'),null,['--publish']]
];
const results=[];
for(const [name,prepare,input,args] of cases) {
 const project=path.join(root,'negative-projects',name.replaceAll(' ','-')); fs.mkdirSync(path.dirname(project),{recursive:true}); fs.rmSync(project,{recursive:true,force:true}); fs.cpSync(seed,project,{recursive:true}); prepare(project);
 const before=snapshot(project); const outsideFiles=['outside-native.md','outside-canonical.md'].map(name=>path.join(root,name)).filter(file=>fs.existsSync(file)); const externalBefore=outsideFiles.map(file=>fs.readFileSync(file));
 const result=invoke(project,input===undefined?{...rules[1],body:'- Validate aggregate before storing.\n'}:input,args||[]);
 assert.notEqual(result.status,0,name); assert.deepEqual(snapshot(project),before,name+' no mutation');
 outsideFiles.forEach((file,i)=>assert.deepEqual(fs.readFileSync(file),externalBefore[i]));
 results.push({case:name,exit:result.status,error:result.stderr.trim(),unchangedProjectBytes:true,existingCanonicalSources:3});
}
fs.writeFileSync(path.join(root,'negative-commands.json'),JSON.stringify(log,null,2)); fs.writeFileSync(path.join(root,'negative-results.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify({negativeCases:results.length,allExistingMultiSourceProjectsUnchanged:true,evidence:path.join(root,'negative-results.json')}));
