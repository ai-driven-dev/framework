import { ValidationError } from './invoice.ts';

// Team reviewed domain change
export function calculatePercentageDiscountCents(totalCents: number, percent: number): number {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0) {
    throw new ValidationError('Total must be nonnegative safe integer cents');
  }
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new ValidationError('Percent must be finite and between 0 and 100');
  }
  return Math.floor(totalCents * percent / 100);
}
