import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateDiscountCents } from '../src/domain/discount.ts';
import { ValidationError } from '../src/domain/invoice.ts';

test('calculateDiscountCents applies floor rounding on normal totals', () => {
  assert.equal(calculateDiscountCents(10_000, 15), 1500);
  assert.equal(calculateDiscountCents(999, 33), 329);
  assert.equal(calculateDiscountCents(1, 50), 0);
});

test('calculateDiscountCents at percent boundaries', () => {
  assert.equal(calculateDiscountCents(6447, 0), 0);
  assert.equal(calculateDiscountCents(6447, 100), 6447);
  assert.equal(calculateDiscountCents(0, 100), 0);
});

test('calculateDiscountCents rejects invalid inputs', () => {
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
    assert.throws(() => calculateDiscountCents(totalCents, percent), ValidationError);
  }
});
