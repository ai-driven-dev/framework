#!/usr/bin/env python3
"""Native Copilot loopback probe; no account files or remote model calls."""
import argparse, hashlib, json, os, shutil, subprocess, tempfile, threading, time
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ap = argparse.ArgumentParser()
ap.add_argument('--repo', required=True)
ap.add_argument('--binary', required=True)
ap.add_argument('--node', required=True)
ap.add_argument('--dist', help='Optional exact extracted Copilot distribution')
ap.add_argument('--output', required=True)
args = ap.parse_args()
repo, out = Path(args.repo).resolve(), Path(args.output).resolve()
out.mkdir(parents=True, exist_ok=True)
project = out / 'project'
fixture = repo / 'aidd_docs/tasks/2026_10/2026_10_09_autonomous-rule-generation/realistic-sandbox/fixture'
shutil.copytree(fixture, project)
skill = project / '.github/skills/aidd-rule-generate'
shutil.copytree(repo / 'plugins/aidd-context/skills/05-rule-generate', skill)
writer = skill / 'scripts/write-rule.cjs'
writer_sha = hashlib.sha256(writer.read_bytes()).hexdigest()
assert writer_sha == '70783e579b75b9e22760239cbfd4309641bdd73840b17e7dfd606a252679a420'
original_agents = (project / 'AGENTS.md').read_bytes()
(out / 'original-AGENTS.bin').write_bytes(original_agents)
definitions = [
    ('07-quality', '7-global-probe', [], 'GLOBAL'),
    ('08-domain', '8-domain-probe', ['src/domain/**/*.ts'], 'DOMAIN'),
    ('09-other', '9-docs-probe', ['docs/**/*.md'], 'DOCS'),
]
rules, writer_receipts, results = [], [], []
def rule_body(label, version):
    return f'# {label.title()} probe\n\n- Preserve the exact COPILOT_{label}_{version}_OCT11 instruction.\n'
def write_rule(rule=None, delete=None):
    command = [args.node, str(writer), '--project', str(project), '--tools', 'copilot']
    if delete:
        command += ['--delete', delete]
    else:
        request = out / f'request-{len(writer_receipts)}.json'
        request.write_text(json.dumps(rule))
        command += ['--input', str(request)]
    run = subprocess.run(command, env={'PATH': ''}, capture_output=True, text=True, timeout=30)
    writer_receipts.append({'argv': command, 'exit': run.returncode, 'stdout': run.stdout, 'stderr': run.stderr})
    (out / 'writer-results.json').write_text(json.dumps(writer_receipts, indent=2))
    assert run.returncode == 0, run.stderr
    assert (project / 'AGENTS.md').read_bytes() == original_agents

def leaves(value):
    if isinstance(value, str): return [value]
    if isinstance(value, list): return [s for v in value for s in leaves(v)]
    if isinstance(value, dict): return [s for v in value.values() for s in leaves(v)]
    return []

def session(stage, target, file):
    case = out / f'{stage}-{target}'
    case.mkdir()
    work = case / 'project'
    shutil.copytree(project, work)
    home = case / 'home'
    home.mkdir()
    records, errors = [], []
    class Mock(BaseHTTPRequestHandler):
        def log_message(self, *unused): pass
        def do_POST(self):
            try:
                request = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                records.append({'path': self.path, 'body': request})
                (case / 'requests.json').write_text(json.dumps(records, indent=2))
                if len(records) == 1:
                    functions = [t.get('function', {}) for t in request.get('tools', [])]
                    view = next((f for f in functions if f.get('name') == 'view'), None)
                    if not view: raise ValueError('No view tool in actual request schema: '+str([f.get('name') for f in functions]))
                    params = view.get('parameters', {})
                    if 'path' not in params.get('properties', {}): raise ValueError('Actual view schema has no path: '+json.dumps(params))
                    unknown = set(params.get('required', [])) - {'path', 'view_range'}
                    if unknown: raise ValueError('Unsupported actual required view fields: '+str(unknown))
                    arguments = {'path': str(work / file)}
                    if 'view_range' in params.get('required', []): arguments['view_range'] = [1, 30]
                    delta = {'role':'assistant', 'tool_calls':[{'index':0,'id':'call_fixture','type':'function','function':{'name':'view','arguments':json.dumps(arguments)}}]}
                    finish = 'tool_calls'
                else:
                    delta, finish = {'role':'assistant','content':'LOCAL_CAPTURE_DONE'}, 'stop'
                self.send_response(200)
                self.send_header('Content-Type','text/event-stream')
                self.end_headers()
                for chunk in [dict(delta=delta, finish_reason=None), dict(delta={}, finish_reason=finish)]:
                    response = {'id':'local-capture','object':'chat.completion.chunk','created':int(time.time()),'model':request.get('model','aidd-capture'),'choices':[{'index':0,**chunk}]}
                    self.wfile.write(('data: '+json.dumps(response)+'\n\n').encode())
                self.wfile.write(b'data: [DONE]\n\n')
                self.wfile.flush()
            except Exception as error:
                errors.append(str(error))
                (case / 'mock-errors.json').write_text(json.dumps(errors, indent=2))
                self.send_error(500, str(error))
    server = ThreadingHTTPServer(('127.0.0.1',0), Mock)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    env = {
        'PATH': str(Path(args.node).parent)+':/usr/bin:/bin',
        'HOME': str(home), 'USERPROFILE': str(home), 'COPILOT_HOME': str(home / '.copilot'),
        'XDG_CONFIG_HOME': str(home / '.config'), 'XDG_CACHE_HOME': str(home / '.cache'),
        'TMPDIR': str(case), 'TERM':'dumb',
        'COPILOT_OFFLINE':'true', 'COPILOT_AUTO_UPDATE':'false',
        'COPILOT_PROVIDER_BASE_URL':f'http://127.0.0.1:{server.server_port}/v1',
        'COPILOT_PROVIDER_TYPE':'openai', 'COPILOT_PROVIDER_WIRE_API':'completions',
        'COPILOT_PROVIDER_TRANSPORT':'http', 'COPILOT_PROVIDER_API_KEY':'local-fake',
        'COPILOT_MODEL':'gpt-4', 'COPILOT_PROVIDER_WIRE_MODEL':'aidd-capture',
        'COPILOT_PROVIDER_MAX_PROMPT_TOKENS':'131072', 'COPILOT_PROVIDER_MAX_OUTPUT_TOKENS':'2048',
    }
    if args.dist: env['COPILOT_CLI_DIST_DIR'] = args.dist
    command = [args.binary, '--no-auto-update', '--no-auto-login', '--disable-builtin-mcps', '--no-remote-export', '--no-color', '--allow-all-tools', '--available-tools', 'view', '-p', f'Read {file} using view, then reply LOCAL_CAPTURE_DONE. Do not write files.']
    (case / 'invocation.json').write_text(json.dumps({'argv':command,'env':env,'cwd':str(work)},indent=2))
    try:
        run = subprocess.run(command, cwd=work, env=env, capture_output=True, text=True, timeout=55)
        status, stdout, stderr = run.returncode, run.stdout, run.stderr
    except subprocess.TimeoutExpired as error:
        status = None
        stdout, stderr = error.stdout or b'', error.stderr or b''
        if isinstance(stdout, bytes): stdout = stdout.decode(errors='replace')
        if isinstance(stderr, bytes): stderr = stderr.decode(errors='replace')
    finally:
        server.shutdown()
        server.server_close()
    (case / 'stdout.log').write_text(stdout)
    (case / 'stderr.log').write_text(stderr)
    texts = ['\n'.join(leaves(r['body'])) for r in records]
    body_counts = {label+'_'+version:[t.count(rule_body(label, version)) for t in texts] for *_,label in definitions for version in ['OLD','NEW']}
    selected = ['GLOBAL'] + ([target.upper()] if target != 'outside' else [])
    version = 'OLD' if stage == 'create' else 'NEW'
    expected = [l+'_'+version for l in selected] if stage != 'delete' else []
    last = texts[-1] if texts else ''
    body_present = all(rule_body(k.rsplit('_',1)[0],version) in last for k in expected)
    unexpected_absent = all(rule_body(label,v) not in last for *_,label in definitions for v in ['OLD','NEW'] if label+'_'+v not in expected)
    agents_preserved = (work / 'AGENTS.md').read_bytes() == original_agents
    result = {'stage':stage,'target':target,'exit':status,'requests':len(records),'mockErrors':errors,'bodyCounts':body_counts,'expectedBodies':expected,'expectedCompleteBodiesPresent':body_present,'unexpectedBodiesAbsent':unexpected_absent,'agentsExactlyPreserved':agents_preserved,'readerResultConfirmed':'LOCAL_CAPTURE_DONE' in stdout,'scopeBodyPass':bool(records) and status==0 and body_present and unexpected_absent and agents_preserved}
    (case / 'summary.json').write_text(json.dumps(result,indent=2))
    results.append(result)
    (out / 'results.json').write_text(json.dumps({'writerSha256':writer_sha,'runs':results},indent=2))
    print(json.dumps(result),flush=True)

for stage in ['create','update','delete']:
    for category,slug,paths,label in definitions:
        if stage == 'delete': write_rule(delete=category+'/'+slug)
        else:
            rule = dict(category=category,slug=slug,description=label.title()+' probe',paths=paths,body=rule_body(label,'OLD' if stage=='create' else 'NEW'))
            write_rule(rule)
    for target,file in [('domain','src/domain/invoice.ts'),('docs','docs/api.md'),('outside','src/http/app.ts')]:
        session(stage,target,file)
assert (project / 'AGENTS.md').read_bytes() == original_agents
print('EVIDENCE='+str(out),flush=True)
