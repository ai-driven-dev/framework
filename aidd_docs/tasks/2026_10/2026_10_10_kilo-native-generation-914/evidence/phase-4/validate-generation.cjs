const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const evidenceDir = __dirname;
const projectDir = path.join(evidenceDir, 'generated-project');
const relativeFiles = [
  '.kilo/agents/verify-agent.md',
  '.kilo/agents/assets/agent-payload.txt',
  '.kilo/commands/verify-workflow.md',
];
const expectedPayload = 'AGENT_APPLIED:willow-5836\n';
const read = (relative) => fs.readFileSync(path.join(projectDir, relative), 'utf8');
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const parseMarkdown = (relative) => {
  const text = read(relative);
  const match = text.match(/^---\n([\s\S]*?)\n---\n/u);
  if (!match) throw new Error(`${relative}: missing YAML frontmatter`);
  return { text, fields: yaml.load(match[1]) };
};

const agent = parseMarkdown(relativeFiles[0]);
const command = parseMarkdown(relativeFiles[2]);
const agentKeys = Object.keys(agent.fields).sort();
const commandKeys = Object.keys(command.fields).sort();
if (JSON.stringify(agentKeys) !== JSON.stringify(['description', 'mode', 'permission', 'temperature'])) {
  throw new Error(`Unexpected Kilo agent fields: ${agentKeys.join(', ')}`);
}
if (agent.fields.description !== 'Verify the phase four fixture payload and return its exact content.' ||
    agent.fields.mode !== 'subagent' || agent.fields.temperature !== 0 ||
    agent.fields.permission?.read !== 'allow' || /^---[\s\S]*?\nname:/u.test(agent.text)) {
  throw new Error('Kilo agent fields do not match the captured fixture input');
}
if (!agent.text.includes('# Role') || !agent.text.includes('# Behavior') ||
    !agent.text.includes('.kilo/agents/assets/agent-payload.txt')) {
  throw new Error('Kilo agent body is incomplete');
}
if (JSON.stringify(commandKeys) !== JSON.stringify(['agent', 'description', 'subtask', 'variant'])) {
  throw new Error(`Unexpected Kilo workflow fields: ${commandKeys.join(', ')}`);
}
if (command.fields.description !== 'Verify the phase four fixture by invoking its subagent.' ||
    command.fields.agent !== 'verify-agent' || command.fields.variant !== 'minimal' ||
    command.fields.subtask !== true || /argument-hint|allowed-tools|disable-model-invocation/u.test(command.text) ||
    !command.text.includes('Invoke `verify-agent` as a subtask')) {
  throw new Error('Kilo workflow fields or body do not match the captured fixture input');
}
if (read(relativeFiles[1]) !== expectedPayload) throw new Error('Agent payload does not match the fixture oracle');

const artifacts = Object.fromEntries(relativeFiles.map((relative) => [relative, {
  sha256: digest(fs.readFileSync(path.join(projectDir, relative))),
  bytes: fs.statSync(path.join(projectDir, relative)).size,
}]));
const result = {
  verdict: 'pass',
  validation: 'YAML frontmatter, Kilo field allowlists, body shape, canonical paths, payload fixture',
  artifacts,
};
fs.writeFileSync(path.join(evidenceDir, 'generation-validation.json'), `${JSON.stringify(result, null, 2)}\n`);

const receipt = {
  kind: 'new-replay',
  generated_at_utc: new Date().toISOString(),
  caller: 'Codex principal applying aidd-context:06-agent-generate and aidd-context:07-command-generate',
  router_loaded: 'installed aidd-context 2.8.1 SKILL.md; action routing only',
  contracts_applied: 'phase-4 candidate actions and references at HEAD 19c81c4f',
  interactive_answers: false,
  fixture_inputs: {
    agent: {
      proposed_names: ['verifier', 'inspector', 'verify-agent'],
      selected_name: 'verify-agent',
      purpose: 'Read one bundled fixture payload and return its exact content.',
      mode: 'Kilo host project',
      requested_options: { temperature: 0, permission: { read: 'allow' } },
      model: 'not requested',
    },
    workflow: {
      name: 'verify-workflow',
      goal: 'Invoke verify-agent as a subtask and return its exact fixture payload.',
      location: 'flat .kilo/commands/',
      arguments: 'none',
      mode: 'Kilo host project',
      requested_options: { agent: 'verify-agent', variant: 'minimal', subtask: true },
    },
  },
  fixture_note: 'Names and choices are synthetic test inputs, not an interactive user response. Outputs were rendered by the current Codex caller by following the named capture, write, and validate actions.',
  generated_files: artifacts,
  source_contract_hashes: 'source-contract-hashes.txt, produced by replay-kilo.sh from the candidate skill router, capture/write/validate actions, references, and templates',
  runtime_copy: 'replay-kilo.sh copies generated-project into a fresh /tmp project and compares SHA-256 values before and after Kilo consumes it',
};
fs.writeFileSync(path.join(evidenceDir, 'caller-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ verdict: result.verdict, artifacts: Object.keys(artifacts).length })}\n`);
