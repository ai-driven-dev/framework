import base64, hashlib, json, os, pathlib, subprocess, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

root = pathlib.Path(__file__).resolve().parent
project, home = root / 'project', root / 'home'
project.mkdir(); home.mkdir()
(project / '.cursor/rules/01-standards').mkdir(parents=True)
(project / 'src/domain').mkdir(parents=True)
(project / 'AGENTS.md').write_text('# Local probe\nAIDD_CURSOR_AGENTS_OCT11\n')
(project / '.cursor/rules/01-standards/1-global.mdc').write_text('---\ndescription: "Local global probe"\nalwaysApply: true\n---\nAIDD_CURSOR_GLOBAL_OCT11\n')
(project / '.cursor/rules/01-standards/1-domain.mdc').write_text('---\ndescription: "Local domain probe"\nglobs: "src/domain/**/*.ts"\nalwaysApply: false\n---\nAIDD_CURSOR_DOMAIN_OCT11\n')
(project / 'src/domain/invoice.ts').write_text('export const invoiceCents = 100;\n')
requests = []
class Endpoint(BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def record(self):
        raw = self.rfile.read(min(int(self.headers.get('Content-Length', '0')), 1048576))
        requests.append({'method': self.command, 'path': self.path, 'contentType': self.headers.get('Content-Type'), 'accept': self.headers.get('Accept'), 'bytes': len(raw), 'bodyBase64': base64.b64encode(raw).decode(), 'bodySha256': hashlib.sha256(raw).hexdigest(), 'markerPresence': {marker: marker.encode() in raw for marker in ['AIDD_CURSOR_AGENTS_OCT11', 'AIDD_CURSOR_GLOBAL_OCT11', 'AIDD_CURSOR_DOMAIN_OCT11']}})
        self.send_response(501)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(b'{"code":"unimplemented","message":"Local probe refuses unknown protocol; no forwarding."}')
    do_POST = do_GET = do_CONNECT = record
server = ThreadingHTTPServer(('127.0.0.1', 0), Endpoint)
threading.Thread(target=server.serve_forever, daemon=True).start()
endpoint = 'http://127.0.0.1:' + str(server.server_port)
policy = '(version 1) (allow default) (deny network*) (allow network-outbound (remote ip "localhost:*"))'
(root / 'network.sb').write_text(policy)
env = {'PATH': '/usr/bin:/bin', 'HOME': str(home), 'USERPROFILE': str(home), 'XDG_CONFIG_HOME': str(home / '.config'), 'XDG_DATA_HOME': str(home / '.local/share'), 'XDG_CACHE_HOME': str(home / '.cache'), 'CURSOR_CONFIG_DIR': str(home / '.cursor'), 'CURSOR_API_KEY': 'local-only-no-credentials', 'CURSOR_API_ENDPOINT': endpoint, 'AGENT_CLI_CREDENTIAL_STORE': 'memory', 'TERM': 'dumb', 'CI': '1', 'NO_OPEN_BROWSER': '1', 'TMPDIR': str(root)}
binary = '<home>/.local/bin/cursor-agent'
command = ['/usr/bin/sandbox-exec', '-f', str(root / 'network.sb'), binary, '--endpoint', endpoint, '--print', '--output-format', 'stream-json', '--mode', 'ask', '--sandbox', 'enabled', '--trust', '--workspace', str(project), 'Return LOCAL_OK without using tools.']
try:
    result = subprocess.run(command, cwd=project, env=env, capture_output=True, text=True, timeout=40)
    stdout, stderr, code = result.stdout, result.stderr, result.returncode
except subprocess.TimeoutExpired as error:
    stdout, stderr, code = (error.stdout or b'').decode(), (error.stderr or b'').decode(), 'timeout'
finally:
    server.shutdown(); server.server_close()
summary = {'command': command, 'version': '2026.10.01-e373342', 'exit': code, 'endpoint': endpoint, 'nativeRequests': len(requests), 'networkPolicy': policy, 'credentials': 'dummy only; memory store; no auth copied', 'modelInference': False, 'verdict': 'endpoint receipt only; controlled protocol refusal', 'markersReceived': {marker: any(record['markerPresence'][marker] for record in requests) for marker in ['AIDD_CURSOR_AGENTS_OCT11', 'AIDD_CURSOR_GLOBAL_OCT11', 'AIDD_CURSOR_DOMAIN_OCT11']}}
for name, text in [('stdout.log', stdout), ('stderr.log', stderr), ('requests.json', json.dumps(requests, indent=2)), ('summary.json', json.dumps(summary, indent=2))]: (root / name).write_text(text)
print(json.dumps(summary, indent=2))
