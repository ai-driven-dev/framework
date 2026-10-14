import { ValidationError } from './invoice.ts';

// Team reviewed domain change
export function calculateDiscountCents(totalCents: number, percent: number): number {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0) throw new ValidationError('Total must be nonnegative safe integer cents');
  if (!Number.isSafeInteger(percent) || percent < 0 || percent > 100) throw new ValidationError('Percent must be integer between 0 and 100');
  const product = totalCents * percent;
  if (!Number.isSafeInteger(product)) throw new ValidationError('Discount calculation exceeds safe integer cents');
  return Math.floor(product / 100);
}
