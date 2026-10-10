from pathlib import Path
import json,hashlib,stat
base=Path('/tmp/aidd-914-p3-refusals');base.mkdir(exist_ok=True)
def put(root,file,content):
 p=root/file;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(content)
def snapshot(root):
 out={}
 for p in sorted(root.rglob('*')):
  s=p.lstat();item={'mode':stat.S_IMODE(s.st_mode),'mtimeNs':s.st_mtime_ns}
  if p.is_symlink():item.update(type='symlink',target=str(p.readlink()))
  elif p.is_file():item.update(type='file',sha256=hashlib.sha256(p.read_bytes()).hexdigest())
  else:item.update(type='dir')
  out[str(p.relative_to(root))]=item
 return out
# All supplied targets are synthetic fixture requests, not production files.
for name in ['portable-without-consent','duplicate-copies','late-nonregular','symlink','readonly','escaping-reference']:
 root=base/name;root.mkdir(exist_ok=True);put(root,'kilo.json','{}\n')
put(base/'duplicate-copies','.kilo/skills/verify-payload/SKILL.md','# Native user copy\n')
put(base/'duplicate-copies','.agents/skills/verify-payload/SKILL.md','# Portable user copy\n')
put(base/'late-nonregular','.kilo/skills/verify-payload','USER_FILE_NOT_DIRECTORY\n')
(base/'symlink'/'.kilo').symlink_to('/tmp/aidd-914-p3-generation/native/.kilo',target_is_directory=True)
put(base/'readonly','.kilo/skills/verify-payload/SKILL.md','# Keep read only\n');(base/'readonly'/'.kilo/skills/verify-payload/SKILL.md').chmod(0o444)
put(base/'escaping-reference','outside.txt','USER_OUTSIDE\n')
before={p.name:snapshot(p) for p in base.iterdir()}
# Caller executes scope/write preflight from the candidate: inspect inputs,
# resolve each unsafe condition, stop each run before mkdir or artifact writes.
assert not (base/'portable-without-consent'/'.agents/skills').exists()
assert all((base/'duplicate-copies'/p/'verify-payload/SKILL.md').is_file() for p in ['.kilo/skills','.agents/skills'])
assert (base/'late-nonregular'/'.kilo/skills/verify-payload').is_file()
assert (base/'symlink'/'.kilo').is_symlink()
assert (base/'readonly'/'.kilo/skills/verify-payload/SKILL.md').stat().st_mode & 0o222 == 0
assert not (base/'escaping-reference'/'.kilo/skills/verify-payload/../../../outside.txt').resolve().is_relative_to(base/'escaping-reference'/'.kilo/skills/verify-payload')
reasons={'portable-without-consent':'No explicit portable agreement: do not hand portable target to plan; request placement choice.','duplicate-copies':'Native and portable user copies: request resolution before write, delete neither.','late-nonregular':'Claude first target valid, final Kilo skill root is regular user file: refuse entire publication.','symlink':'Existing .kilo ancestor is symlink: refuse entire publication.','readonly':'Existing selected SKILL.md has no write permission: refuse entire publication.','escaping-reference':'Planned action reference resolves outside skill tree: refuse entire publication.'}
after={p.name:snapshot(p) for p in base.iterdir()};assert before==after
out=Path('aidd_docs/tasks/2026_10/2026_10_10_kilo-native-generation-914/evidence/phase-3/caller-refusals.json')
out.write_text(json.dumps({'scope':'native caller interpreted candidate actions; not separate model inference nor deterministic shipped writer','cases':[{'name':n,'decision':reason,'before':before[n],'after':after[n],'unchanged':True} for n,reason in reasons.items()]},indent=2)+'\n')
print('6 refused caller runs; full tree bytes/mode/mtime unchanged')
