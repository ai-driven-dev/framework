import argparse, gzip, json, os, pathlib, shutil, subprocess, tempfile, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

parser = argparse.ArgumentParser()
parser.add_argument('--project', type=pathlib.Path)
parser.add_argument('--expect', action='append', default=[])
parser.add_argument('--absent', action='append', default=[])
args = parser.parse_args()
root = pathlib.Path(tempfile.mkdtemp(prefix='aidd-913-codex-run-', dir='/tmp')).resolve()
binary = '/Users/baptistelafourcade/.nvm/versions/node/v24.20.0/bin/codex'
captures = []

class Model(BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def do_POST(self):
        raw = self.rfile.read(int(self.headers['Content-Length']))
        if self.headers.get('Content-Encoding') == 'gzip': raw = gzip.decompress(raw)
        captures.append({'path': self.path, 'body': json.loads(raw)})
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream')
        self.end_headers()
        for event in [
            {'type': 'response.created', 'response': {'id': 'resp_local'}},
            {'type': 'response.output_item.done', 'item': {'type': 'message', 'role': 'assistant', 'id': 'msg_local', 'content': [{'type': 'output_text', 'text': 'LOCAL_OK'}]}},
            {'type': 'response.completed', 'response': {'id': 'resp_local', 'usage': {'input_tokens': 0, 'input_tokens_details': None, 'output_tokens': 0, 'output_tokens_details': None, 'total_tokens': 0}}},
        ]:
            self.wfile.write(('data: ' + json.dumps(event) + '\n\n').encode())
        self.wfile.flush()

server = ThreadingHTTPServer(('127.0.0.1', 0), Model)
threading.Thread(target=server.serve_forever, daemon=True).start()
summaries = []

def run(name, source=None, override=False, nested=False, expected=None, forbidden=None):
    case = root / name
    project, profile, codex_home = case / 'project', case / 'home', case / 'codex-home'
    profile.mkdir(parents=True)
    codex_home.mkdir()
    if source: shutil.copytree(source, project)
    else:
        project.mkdir()
        (project / 'AGENTS.md').write_text('# Project guidance\nAIDD_ROOT_RULE_913\n')
    subprocess.run(['git', 'init', '-q'], cwd=project, check=True, capture_output=True)
    if override: (project / 'AGENTS.override.md').write_text('# Override\nAIDD_OVERRIDE_RULE_913\n')
    cwd = project
    if nested:
        cwd = project / 'nested'
        cwd.mkdir()
        (cwd / 'AGENTS.md').write_text('# Nested guidance\nAIDD_NESTED_RULE_913\n')
    config = '\n'.join([
        'model = "gpt-5.1-codex"', 'model_provider = "local"',
        'approval_policy = "never"', 'sandbox_mode = "read-only"',
        'cli_auth_credentials_store = "ephemeral"', 'web_search = "disabled"',
        '[analytics]', 'enabled = false',
        '[model_providers.local]', 'name = "Local capture"',
        f'base_url = "http://127.0.0.1:{server.server_port}/v1"',
        'wire_api = "responses"', 'requires_openai_auth = false',
        'supports_websockets = false', 'request_max_retries = 0', 'stream_max_retries = 0',
        f'[projects.{json.dumps(str(project))}]', 'trust_level = "trusted"',
    ])
    (codex_home / 'config.toml').write_text(config)
    env = {'PATH': os.environ['PATH'], 'HOME': str(profile), 'CODEX_HOME': str(codex_home),
           'USERPROFILE': str(profile), 'XDG_CONFIG_HOME': str(profile / '.config'),
           'XDG_DATA_HOME': str(profile / '.local/share'), 'XDG_CACHE_HOME': str(profile / '.cache'),
           'TMPDIR': str(case), 'TERM': 'dumb'}
    start = len(captures)
    result = subprocess.run([binary, 'exec', '--ephemeral', '--ignore-rules', '--color', 'never',
                             '--json', '-C', str(cwd), 'Return LOCAL_OK and use no tools.'],
                            cwd=cwd, env=env, capture_output=True, text=True, timeout=45)
    requests = captures[start:]
    (case / 'requests.json').write_text(json.dumps(requests, indent=2))
    (case / 'stdout.log').write_text(result.stdout)
    (case / 'stderr.log').write_text(result.stderr)
    text = json.dumps([r['body'].get('input') for r in requests], ensure_ascii=False)
    checks = {marker: marker in text for marker in expected or []}
    absent = {marker: marker not in text for marker in forbidden or []}
    summary = {'case': name, 'exit': result.returncode, 'requests': len(requests), 'paths': [r['path'] for r in requests], 'present': checks, 'absent': absent}
    summaries.append(summary)
    print(json.dumps(summary), flush=True)
    assert result.returncode == 0 and requests and all(checks.values()) and all(absent.values()), name

try:
    if args.project:
        run('generated', source=args.project.resolve(), expected=args.expect, forbidden=args.absent)
    else:
        run('root', expected=['AIDD_ROOT_RULE_913'])
        run('override', override=True, expected=['AIDD_OVERRIDE_RULE_913'], forbidden=['AIDD_ROOT_RULE_913'])
        run('nested', nested=True, expected=['AIDD_ROOT_RULE_913', 'AIDD_NESTED_RULE_913'])
finally:
    server.shutdown()
    (root / 'summary.json').write_text(json.dumps(summaries, indent=2))
    print(str(root), flush=True)
