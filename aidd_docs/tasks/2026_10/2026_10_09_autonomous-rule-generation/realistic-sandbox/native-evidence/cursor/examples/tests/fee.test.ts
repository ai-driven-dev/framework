import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateFeeCents } from '../src/domain/fee.ts';
import { ValidationError } from '../src/domain/invoice.ts';

test('calculateFeeCents applies floor rounding on normal totals', () => {
  assert.equal(calculateFeeCents(10_000, 15), 1500);
  assert.equal(calculateFeeCents(999, 33), 329);
  assert.equal(calculateFeeCents(1, 50), 0);
});

test('calculateFeeCents at percent boundaries', () => {
  assert.equal(calculateFeeCents(6447, 0), 0);
  assert.equal(calculateFeeCents(6447, 100), 6447);
  assert.equal(calculateFeeCents(0, 100), 0);
});

test('calculateFeeCents rejects invalid inputs', () => {
  for (const [totalCents, percent] of [
    [-1, 10],
    [100, -1],
    [100, 101],
    [1.5, 10],
    [100, 12.5],
    [Number.NaN, 10],
    [100, Number.NaN],
    [Number.MAX_SAFE_INTEGER, 2],
  ] as const) {
    assert.throws(() => calculateFeeCents(totalCents, percent), ValidationError);
  }
});
