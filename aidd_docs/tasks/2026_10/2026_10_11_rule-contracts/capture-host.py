"""Capture actual host requests using local fixed replies, never subscription auth."""
import argparse
import gzip
import json
import os
import signal
import stat
from pathlib import Path
import subprocess
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

parser = argparse.ArgumentParser()
parser.add_argument('--host', choices=['claude', 'codex', 'opencode'], required=True)
parser.add_argument('--binary', type=Path, required=True)
parser.add_argument('--project', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--read', default='src/domain/invoice.ts')
parser.add_argument('--setting-sources', default='project')
parser.add_argument('--timeout', type=float, default=55)
args = parser.parse_args()
assert 0 < args.timeout <= 55
project, output = args.project.resolve(), args.output.resolve()
with os.fdopen(os.open(project / '.aidd-runtime-owner.json', os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK), 'r') as marker:
    assert stat.S_ISREG(os.fstat(marker.fileno()).st_mode), 'Ownership marker must be a regular file.'
    ownership = json.load(marker)
root = Path(ownership['root']).resolve()
assert ownership['owner'] == 'aidd-rule-contract-runtime-v1'
assert root.parent == Path(tempfile.gettempdir()).resolve() and root.name.startswith('aidd-rule-contract-runtime-')
assert project.parent == root / 'projects' and output.parent == root / 'captures'
output.mkdir(parents=True, exist_ok=False)
profile = output / 'profile'
profile.mkdir()
requests = []


class Model(BaseHTTPRequestHandler):
    def log_message(self, *unused):
        pass

    def do_POST(self):
        raw = self.rfile.read(int(self.headers['Content-Length']))
        if self.headers.get('Content-Encoding') == 'gzip':
            raw = gzip.decompress(raw)
        body = json.loads(raw)
        requests.append({'path': self.path, 'body': body})
        if args.host == 'codex':
            events = [
                {'type': 'response.created', 'response': {'id': 'resp_local'}},
                {'type': 'response.output_item.done', 'item': {'type': 'message', 'role': 'assistant', 'id': 'msg_local', 'content': [{'type': 'output_text', 'text': 'LOCAL_OK'}]}},
                {'type': 'response.completed', 'response': {'id': 'resp_local', 'usage': {'input_tokens': 0, 'input_tokens_details': None, 'output_tokens': 0, 'output_tokens_details': None, 'total_tokens': 0}}},
            ]
        elif args.host == 'claude':
            usage = {'input_tokens': 10, 'output_tokens': 2, 'cache_creation_input_tokens': 0, 'cache_read_input_tokens': 0}
            messages = body.get('messages', [])
            read_offered = any(tool.get('name') == 'Read' for tool in body.get('tools', []))
            already_read = any('tool_result' in json.dumps(message) for message in messages)
            use_read = read_offered and not already_read
            block = ({'type': 'tool_use', 'id': 'read_local', 'name': 'Read', 'input': {}} if use_read else {'type': 'text', 'text': ''})
            delta = ({'type': 'input_json_delta', 'partial_json': json.dumps({'file_path': str(project / args.read)})} if use_read else {'type': 'text_delta', 'text': 'LOCAL_OK'})
            reason = 'tool_use' if use_read else 'end_turn'
            if not body.get('stream'):
                if use_read:
                    block['input'] = {'file_path': str(project / args.read)}
                else:
                    block['text'] = 'LOCAL_OK'
                reply = {'id': 'msg_local', 'type': 'message', 'role': 'assistant', 'model': body.get('model'), 'content': [block], 'stop_reason': reason, 'stop_sequence': None, 'usage': usage}
                self.send_json(reply)
                return
            events = [
                {'type': 'message_start', 'message': {'id': 'msg_local', 'type': 'message', 'role': 'assistant', 'model': body.get('model'), 'content': [], 'stop_reason': None, 'stop_sequence': None, 'usage': usage}},
                {'type': 'content_block_start', 'index': 0, 'content_block': block},
                {'type': 'content_block_delta', 'index': 0, 'delta': delta},
                {'type': 'content_block_stop', 'index': 0},
                {'type': 'message_delta', 'delta': {'stop_reason': reason, 'stop_sequence': None}, 'usage': {'output_tokens': 2}},
                {'type': 'message_stop'},
            ]
        else:
            common = {'id': 'chatcmpl-local', 'created': int(time.time()), 'model': 'fake'}
            usage = {'prompt_tokens': 10, 'completion_tokens': 2, 'total_tokens': 12}
            if not body.get('stream'):
                self.send_json({**common, 'object': 'chat.completion', 'choices': [{'index': 0, 'message': {'role': 'assistant', 'content': 'LOCAL_OK'}, 'finish_reason': 'stop'}], 'usage': usage})
                return
            events = [{**common, 'object': 'chat.completion.chunk', 'choices': [{'index': 0, 'delta': delta, 'finish_reason': reason}], **({'usage': usage} if reason else {})} for delta, reason in [({'role': 'assistant'}, None), ({'content': 'LOCAL_OK'}, None), ({}, 'stop')]]
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream')
        self.end_headers()
        for event in events:
            prefix = f"event: {event['type']}\n" if args.host == 'claude' else ''
            self.wfile.write((prefix + 'data: ' + json.dumps(event) + '\n\n').encode())
        if args.host == 'opencode':
            self.wfile.write(b'data: [DONE]\n\n')
        self.wfile.flush()

    def send_json(self, reply):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(reply).encode())


server = ThreadingHTTPServer(('127.0.0.1', 0), Model)
threading.Thread(target=server.serve_forever, daemon=True).start()
env = {'PATH': os.environ['PATH'], 'HOME': str(profile), 'USERPROFILE': str(profile), 'XDG_CONFIG_HOME': str(profile / '.config'), 'XDG_DATA_HOME': str(profile / '.local/share'), 'XDG_CACHE_HOME': str(profile / '.cache'), 'XDG_STATE_HOME': str(profile / '.local/state'), 'TMPDIR': str(output), 'TERM': 'dumb'}
binary = str(args.binary.resolve())
if args.host == 'claude':
    env.update({'CLAUDE_CONFIG_DIR': str(profile / '.claude'), 'ANTHROPIC_API_KEY': 'local-only', 'ANTHROPIC_BASE_URL': f'http://127.0.0.1:{server.server_port}', 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC': '1', 'DISABLE_UPDATES': '1', 'DO_NOT_TRACK': '1'})
    command = [binary, '-p', f'Read {args.read} once, then reply LOCAL_OK.', '--model', 'claude-sonnet-4-6', '--setting-sources', args.setting_sources, '--no-session-persistence', '--disable-slash-commands', '--tools', 'Read', '--allowedTools', 'Read', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--output-format', 'stream-json', '--verbose']
elif args.host == 'codex':
    codex_home = profile / '.codex'
    codex_home.mkdir()
    env['CODEX_HOME'] = str(codex_home)
    config = '\n'.join(['model = "gpt-5.1-codex"', 'model_provider = "local"', 'approval_policy = "never"', 'sandbox_mode = "read-only"', 'cli_auth_credentials_store = "ephemeral"', 'web_search = "disabled"', '[analytics]', 'enabled = false', '[model_providers.local]', 'name = "Local capture"', f'base_url = "http://127.0.0.1:{server.server_port}/v1"', 'wire_api = "responses"', 'requires_openai_auth = false', 'supports_websockets = false', 'request_max_retries = 0', 'stream_max_retries = 0', f'[projects.{json.dumps(str(project))}]', 'trust_level = "trusted"'])
    (codex_home / 'config.toml').write_text(config)
    command = [binary, 'exec', '--ephemeral', '--ignore-rules', '--color', 'never', '--json', '-C', str(project), 'Return LOCAL_OK and use no tools.']
else:
    # Only call against a fresh controlled project: this replaces its mock config.
    config = {'model': 'local/fake', 'snapshots': False, 'instructions': ['inert-rule.md'], 'providers': {'local': {'env': ['AIDD_LOCAL_KEY'], 'package': '@opencode/ai/providers/openai-compatible', 'settings': {'baseURL': f'http://127.0.0.1:{server.server_port}/v1'}, 'models': {'fake': {'limit': {'context': 32000, 'output': 4000}}}}}}
    (project / 'opencode.json').write_text(json.dumps(config))
    env.update({'OPENCODE_CONFIG_DIR': str(profile / '.config/opencode'), 'OPENCODE_DISABLE_MODELS_FETCH': '1', 'OPENCODE_DISABLE_AUTOUPDATE': '1', 'AIDD_LOCAL_KEY': 'local-only'})
    command = [binary, 'run', '--standalone', '--model', 'local/fake', '--format', 'json', 'Reply LOCAL_OK.']
try:
    process = subprocess.Popen(command, cwd=project, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, start_new_session=True)
    stdout, stderr = process.communicate(timeout=args.timeout)
    code = process.returncode
except subprocess.TimeoutExpired:
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    stdout, stderr = process.communicate(timeout=5)
    code = 'timeout'
finally:
    server.shutdown()
(output / 'requests.json').write_text(json.dumps(requests, indent=2, ensure_ascii=False))
(output / 'stdout.log').write_text(stdout)
(output / 'stderr.log').write_text(stderr)
summary = {'host': args.host, 'command': command, 'exit': code, 'requests': len(requests), 'paths': [request['path'] for request in requests]}
(output / 'summary.json').write_text(json.dumps(summary, indent=2))
print(json.dumps(summary))
raise SystemExit(0 if code == 0 and requests else 1)
