"""Reproduce scoped/global lifecycle captures using supplied installed host binaries."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

parser = argparse.ArgumentParser()
parser.add_argument('--repo', type=Path, required=True)
parser.add_argument('--node', required=True)
for host in ['claude', 'codex', 'opencode']:
    parser.add_argument('--' + host, type=Path, required=True)
args = parser.parse_args()
repo = args.repo.resolve()
root = Path(tempfile.mkdtemp(prefix='aidd-rule-contract-runtime-')).resolve()
skill = repo / 'plugins/aidd-context/skills/05-rule-generate'
shutil.copytree(skill, root / 'installed')
writer = root / 'installed/scripts/write-rule.cjs'
capture = Path(__file__).with_name('capture-host.py')
original = b'# User guidance\r\nPreserve project memory.\r\n'
checks = []
operations = []


def write_rule(project, host, slug, patterns, phase):
    request = {'category': '01-standards', 'slug': '1-' + slug, 'description': slug.capitalize(), 'paths': patterns, 'body': '# ' + slug.capitalize() + '\n\n- AIDD_' + slug.upper() + '_' + phase + '_11\n'}
    source = root / 'request.json'
    source.write_text(json.dumps(request))
    call_writer(project, host, ['--input', str(source)])


def call_writer(project, host, extra):
    command = [args.node, str(writer), '--project', str(project), '--tools', host, *extra]
    result = subprocess.run(command, capture_output=True, text=True, env={'PATH': ''}, timeout=15)
    operations.append({'command': command, 'exit': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr})
    assert result.returncode == 0, result.stderr


def run_case(host, project, phase, read='src/domain/invoice.ts', setting_sources='project'):
    name = host + '-' + phase.lower() + '-' + read.replace('/', '_') + '-' + setting_sources
    output = root / 'captures' / name
    command = ['python3', str(capture), '--host', host, '--binary', str(getattr(args, host)), '--project', str(project), '--output', str(output), '--read', read, '--setting-sources', setting_sources]
    result = subprocess.run(command, capture_output=True, text=True, timeout=65)
    assert result.returncode == 0, result.stdout + result.stderr
    requests = json.loads((output / 'requests.json').read_text())
    # Count actual instruction/message context, excluding tool descriptions and logs.
    def strings(value):
        if isinstance(value, str):
            return [value]
        if isinstance(value, list):
            return [text for item in value for text in strings(item)]
        if isinstance(value, dict):
            return [text for item in value.values() for text in strings(item)]
        return []
    contexts = [json.dumps({key: item['body'].get(key) for key in ['system', 'messages', 'input']}, ensure_ascii=False) for item in requests]
    plain_contexts = ['\n'.join(strings({key: item['body'].get(key) for key in ['system', 'messages', 'input']})) for item in requests]
    markers = ['AIDD_' + slug.upper() + '_' + generation + '_11' for generation in ['CREATE', 'UPDATE'] for slug in ['global', 'domain', 'docs']]
    counts = [{marker: context.count(marker) for marker in markers} for context in contexts]
    present = []
    if phase != 'DELETE' and setting_sources == 'project':
        present = ['global']
        if host != 'claude':
            present += ['domain', 'docs']
        else:
            present += ['docs' if read.startswith('docs/') else 'domain']
    for slug in ['global', 'domain', 'docs']:
        for generation in ['CREATE', 'UPDATE']:
            marker = 'AIDD_' + slug.upper() + '_' + generation + '_11'
            should_exist = slug in present and generation == phase
            assert any(count[marker] == 1 for count in counts) if should_exist else all(count[marker] == 0 for count in counts), (name, marker, counts)
            assert all(count[marker] <= 1 for count in counts), (name, 'duplicate context', marker)
            if should_exist:
                body = '# ' + slug.capitalize() + '\n\n- ' + marker + '\n'
                assert any(body in context for context in plain_contexts), (name, 'incomplete body', slug)
    assert all('AIDD_INERT_CONFIG_ONLY_11' not in context for context in contexts), name
    if host == 'claude':
        assert all(counts[0][marker] == 0 for marker in markers if '_DOMAIN_' in marker or '_DOCS_' in marker), (name, 'scoped rule loaded before Read')
        assert any('tool_result' in context and 'export const' in context for context in contexts), (name, 'Read tool did not read fixture')
    checks.append({'case': name, 'exit': result.returncode, 'counts': counts, 'complete_bodies_checked': present, 'request_paths': [item['path'] for item in requests], 'pass': True})
    print(json.dumps({'case': name, 'pass': True}), flush=True)


try:
    for host in ['claude', 'codex', 'opencode']:
        project = root / 'projects' / host
        (project / 'src/domain/nested').mkdir(parents=True)
        (project / 'docs').mkdir()
        (project / '.aidd-runtime-owner.json').write_text(json.dumps({'owner': 'aidd-rule-contract-runtime-v1', 'root': str(root)}))
        (project / 'AGENTS.md').write_bytes(original)
        for file in ['src/domain/invoice.ts', 'src/domain/nested/item.ts']:
            (project / file).write_text('export const invoice = 42;\n')
        (project / 'docs/overview.md').write_text('# Invoice API\nexport const fixtureText = 1;\n')
        (project / 'inert-rule.md').write_text('AIDD_INERT_CONFIG_ONLY_11\n')
        subprocess.run(['git', 'init', '-q'], cwd=project, check=True)
        for phase in ['CREATE', 'UPDATE']:
            for slug, patterns in [('global', []), ('domain', ['src/domain/**/*.ts']), ('docs', ['docs/**/*.md'])]:
                write_rule(project, host, slug, patterns, phase)
            run_case(host, project, phase)
            if host == 'claude':
                run_case(host, project, phase, read='src/domain/nested/item.ts')
                run_case(host, project, phase, read='docs/overview.md')
                if phase == 'CREATE':
                    run_case(host, project, phase, setting_sources='user')
        for slug in ['global', 'domain', 'docs']:
            call_writer(project, host, ['--delete', '01-standards/1-' + slug])
        assert (project / 'AGENTS.md').read_bytes() == original, host
        run_case(host, project, 'DELETE')
finally:
    (root / 'checks.json').write_text(json.dumps(checks, indent=2))
    (root / 'operations.json').write_text(json.dumps(operations, indent=2))
    (root / 'candidate.json').write_text(json.dumps({'writer_sha256': hashlib.sha256(writer.read_bytes()).hexdigest(), 'repo': str(repo), 'root': str(root), 'cases_passed': len(checks)}, indent=2))
    print(str(root), flush=True)
