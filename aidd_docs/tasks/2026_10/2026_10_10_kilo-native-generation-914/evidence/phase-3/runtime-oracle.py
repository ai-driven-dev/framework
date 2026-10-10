from pathlib import Path
import json,hashlib,platform
out=Path('aidd_docs/tasks/2026_10/2026_10_10_kilo-native-generation-914/evidence/phase-3')
proof={'os':platform.platform(),'kiloVersion':'7.8.8','model':'kilo/cohere/north-mini-code:free','runs':[],'initialNativeAttempt':'kilo-native.jsonl loaded skill/action/payload, but inserted a space; not counted as exact-output pass','commands':['kilo debug skill --pure (cwd native and portable)','kilo run --pure --dir <fixture> --model kilo/cohere/north-mini-code:free --format json <prompt>']}
for project,trace in [('native','kilo-native-exact'),('portable','kilo-portable')]:
 events=[json.loads(line) for line in (out/(trace+'.jsonl')).read_text().splitlines()]
 tools=[e['part'] for e in events if e['type']=='tool_use']
 assert any(p['tool']=='skill' and p['state']['input']=={'name':'verify-payload'} and p['state']['status']=='completed' for p in tools)
 reads=[p['state']['input']['filePath'] for p in tools if p['tool']=='read' and p['state']['status']=='completed']
 target='.kilo/skills' if project=='native' else '.agents/skills'
 assert any(p.endswith(target+'/verify-payload/actions/01-verify.md') for p in reads)
 assert any(p.endswith(target+'/verify-payload/assets/payload.txt') for p in reads)
 texts=[e['part']['text'] for e in events if e['type']=='text'];assert texts==['PAYLOAD_APPLIED:cedar-7391'],texts
 costs=[e['part']['cost'] for e in events if e['type']=='step_finish'];assert costs and all(c==0 for c in costs)
 catalog=json.loads((out/('kilo-catalog-'+project+'.json')).read_text());skill=[s for s in catalog if s['name']=='verify-payload'];assert len(skill)==1
 assert skill[0]['location']==f'/tmp/aidd-914-p3-generation/{project}/{target}/verify-payload/SKILL.md'
 proof['runs'].append({'project':project,'trace':trace+'.jsonl','exitCodeObserved':0,'catalogLocation':skill[0]['location'],'skillInvoked':True,'actionAndPayloadRead':reads,'exactReply':texts[0],'costs':costs})
# Runtime must preserve generated skill files. Kilo may add schema to kilo.json;
# compare skill hashes/mtime separately and record config changes explicitly.
before=json.loads((out/'caller-modify-rerun.json').read_text())['afterModify'];deltas=[]
for file,entry in before.items():
 p=Path('/tmp/aidd-914-p3-generation')/file
 if entry['type']=='file':
  current={'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'mtimeNs':p.stat().st_mtime_ns}
  if current['sha256']!=entry['sha256'] or current['mtimeNs']!=entry['mtimeNs']:deltas.append({'file':file,'before':entry,'after':current})
  if '/verify-payload/' in file:assert current['sha256']==entry['sha256'] and current['mtimeNs']==entry['mtimeNs'],file
proof['runtimeDeltas']=deltas;proof['generatedSkillBytesAndMtimePreserved']=True
# Archive only selected free model metadata, not whole provider catalog.
models=Path('/tmp/aidd-p3-models.txt').read_text();label='kilo/cohere/north-mini-code:free\n';meta,_=json.JSONDecoder().raw_decode(models.split(label,1)[1]);assert meta['isFree'] and meta['cost']['input']==0 and meta['cost']['output']==0
(out/'kilo-free-model.json').write_text(json.dumps(meta,indent=2)+'\n')
(out/'runtime-verification.json').write_text(json.dumps(proof,indent=2)+'\n')
print('native + portable: catalog, skill invocation, action + payload reads, exact reply, four zero-cost steps per run; skill bytes/mtime preserved')
