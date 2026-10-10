from pathlib import Path
import json, hashlib, stat
base=Path('/tmp/aidd-914-p3-generation')
cases=json.loads(Path('/tmp/aidd-p3-cases.json').read_text())
# Explicit caller publication for these seven planned fixture trees only. This is
# neither shipped code nor a separate renderer used to stand in for the skill.
body='''
# Verify Payload

```mermaid
flowchart LR
  request([verification request]) --> verify --> answer([verification code])
```

## Actions

Run the flow above. Read only the next action file.

| Action | Does |
| --- | --- |
| verify | verify the bundled payload |

## Transversal rules

- Read [01-verify.md](actions/01-verify.md) before answering.
- Leave project files unchanged.
'''
action='''# 01 - Verify

Verify the bundled payload.

## Input

A request to verify the phase three fixture.

## Output

The verification code.

## Process

1. **Read.** Read [payload.txt](../assets/payload.txt).
2. **Reply.** Return exactly `PAYLOAD_APPLIED:` followed by the trimmed payload, with no extra text.

## Test

| Case | Pass |
| --- | --- |
| A verification request is answered | the payload read is traced and the exact verification code is returned |
'''
description='Verify a bundled payload. Use when the user wants to verify the phase three fixture.'
# Preflight every final path and reference before mkdir/write.
for case in cases:
 project=base/case['project'];target=project/case['target']/'verify-payload'
 assert not target.exists(),target
 assert target.is_relative_to(project)
 for p in [project,*project.parents]:
  assert not p.is_symlink(),p
  assert p.is_dir(),p
 assert project.stat().st_mode & 0o222
 assert case['target'] in ['.kilo/skills','.agents/skills','.claude/skills','.opencode/skills']
 for forbidden in case['absent']:assert not (project/forbidden).exists()
# Fill the read templates, then render each host's field contract.
for case in cases:
 target=base/case['project']/case['target']/'verify-payload'
 fields=['---']
 if 'name' in case['fields']:fields.append('name: verify-payload')
 fields.append('description: '+description)
 if case['project']=='native':fields+=['license: MIT','compatibility: Requires a host that can read local files.','metadata:','  fixture: "phase-three"']
 if case['project']=='claude':fields+=['allowed-tools: Read','disable-model-invocation: true']
 if case['project']=='opencode':fields+=['permission:','  read: allow']
 target.mkdir(parents=True)
 (target/'actions').mkdir();(target/'assets').mkdir()
 (target/'SKILL.md').write_text('\n'.join(fields)+'\n---\n'+body)
 (target/'actions/01-verify.md').write_text(action)
 (target/'assets/payload.txt').write_text('cedar-7391\n')
# User fixture resources are test inputs added after create, outside modify plan.
for case in cases:
 target=base/case['project']/case['target']/'verify-payload'
 (target/'assets/user.txt').write_text('USER_RESOURCE_DO_NOT_REPLACE\n')
 (target/'actions/02-user.md').write_text('# User action\n\nUSER_ACTION_KEEP\n')
