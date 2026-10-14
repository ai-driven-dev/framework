import argparse
import json
import os
from pathlib import Path
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

parser = argparse.ArgumentParser()
parser.add_argument('project', type=Path)
parser.add_argument('case', type=Path)
parser.add_argument('--present', action='append', default=[])
parser.add_argument('--absent', action='append', default=[])
args = parser.parse_args()
args.case.mkdir(parents=True, exist_ok=False)
profile = args.case / 'profile'
profile.mkdir()
requests = []

class Model(BaseHTTPRequestHandler):
    def log_message(self, *unused):
        pass

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        requests.append(body)
        common = {'id': 'chatcmpl-aidd913', 'created': int(time.time()), 'model': 'fake'}
        usage = {'prompt_tokens': 10, 'completion_tokens': 2, 'total_tokens': 12}
        if not body.get('stream'):
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({**common, 'object': 'chat.completion',
                'choices': [{'index': 0, 'message': {'role': 'assistant', 'content': 'OK'},
                             'finish_reason': 'stop'}], 'usage': usage}).encode())
            return
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream')
        self.end_headers()
        for delta, reason in [({'role': 'assistant'}, None), ({'content': 'OK'}, None), ({}, 'stop')]:
            chunk = {**common, 'object': 'chat.completion.chunk',
                     'choices': [{'index': 0, 'delta': delta, 'finish_reason': reason}]}
            if reason:
                chunk['usage'] = usage
            self.wfile.write(('data: ' + json.dumps(chunk) + '\n\n').encode())
        self.wfile.write(b'data: [DONE]\n\n')
        self.wfile.flush()

server = ThreadingHTTPServer(('127.0.0.1', 0), Model)
threading.Thread(target=server.serve_forever, daemon=True).start()
config = {'model': 'local/fake', 'snapshots': False,
          'instructions': ['inert-rule.md'],
          'providers': {'local': {'env': ['AIDD_913_LOCAL_KEY'],
              'package': '@opencode/ai/providers/openai-compatible',
              'settings': {'baseURL': f'http://127.0.0.1:{server.server_port}/v1'},
              'models': {'fake': {'limit': {'context': 32000, 'output': 4000}}}}}}
(args.project / 'opencode.json').write_text(json.dumps(config, indent=2))
env = {'PATH': os.environ['PATH'], 'HOME': str(profile), 'USERPROFILE': str(profile),
       'XDG_CONFIG_HOME': str(profile / '.config'), 'XDG_DATA_HOME': str(profile / '.local/share'),
       'XDG_CACHE_HOME': str(profile / '.cache'), 'XDG_STATE_HOME': str(profile / '.local/state'),
       'OPENCODE_CONFIG_DIR': str(profile / '.config/opencode'),
       'OPENCODE_DISABLE_MODELS_FETCH': '1', 'OPENCODE_DISABLE_AUTOUPDATE': '1',
       'AIDD_913_LOCAL_KEY': 'local-only', 'TERM': 'dumb', 'TMPDIR': str(args.case)}
binary = '/tmp/aidd-953-runtime-ryTstm/v2/node_modules/.bin/opencode2'
command = [binary, 'run', '--standalone', '--model', 'local/fake', '--format', 'json',
           '--print-logs', 'Reply OK.']
try:
    result = subprocess.run(command, cwd=args.project, env=env, capture_output=True,
                            text=True, timeout=55)
    stdout, stderr, code = result.stdout, result.stderr, result.returncode
except subprocess.TimeoutExpired as error:
    stdout = (error.stdout or b'').decode()
    stderr = (error.stderr or b'').decode()
    code = 'timeout'
finally:
    server.shutdown()
messages = '\n'.join(json.dumps(request.get('messages', [])) for request in requests)
present = {marker: marker in messages for marker in args.present}
absent = {marker: marker not in messages for marker in args.absent}
summary = {'command': command, 'binary': binary, 'exit': code, 'model_requests': len(requests),
           'present': present, 'absent': absent,
           'pass': code == 0 and len(requests) > 0 and all(present.values()) and all(absent.values())}
for name, value in [('stdout.log', stdout), ('stderr.log', stderr),
                    ('model-requests.json', json.dumps(requests, indent=2)),
                    ('summary.json', json.dumps(summary, indent=2))]:
    (args.case / name).write_text(value)
print(json.dumps(summary, indent=2))
raise SystemExit(0 if summary['pass'] else 1)
