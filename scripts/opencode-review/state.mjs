import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

// State remains local to the server; a draft is written before publishing so a
// lost GitHub response can be retried without running the model again.
export function stateStore(directory, repository) {
  if (!isAbsolute(directory ?? '') || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? '')) throw new Error('Invalid review state location');
  const root = join(directory, ...repository.split('/'));
  const path = (number) => {
    if (!Number.isSafeInteger(number) || number < 1) throw new Error('Invalid PR number');
    return join(root, `${number}.json`);
  };
  return {
    load(number) {
      let record;
      try { record = JSON.parse(readFileSync(path(number), 'utf8')); }
      catch (error) { if (error.code === 'ENOENT') return { state: null, draft: null }; throw error; }
      if (!record || typeof record !== 'object' || !Object.hasOwn(record, 'state') || !Object.hasOwn(record, 'draft')) throw new Error('Invalid review state');
      return record;
    },
    save(number, record) {
      const target = path(number);
      mkdirSync(root, { recursive: true, mode: 0o700 });
      const temporary = `${target}.${randomUUID()}.tmp`;
      writeFileSync(temporary, JSON.stringify(record), { mode: 0o600, flag: 'wx' });
      renameSync(temporary, target);
    },
  };
}
