import { ValidationError } from './invoice.ts';

// Domain validation reviewed
export function calculateFeeCents(amountCents: number, fixedFeeCents: number): number {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
    throw new ValidationError('Amount must be nonnegative safe integer cents');
  }
  if (!Number.isSafeInteger(fixedFeeCents) || fixedFeeCents < 0) {
    throw new ValidationError('Fixed fee must be nonnegative safe integer cents');
  }
  const totalCents = amountCents + fixedFeeCents;
  if (!Number.isSafeInteger(totalCents)) {
    throw new ValidationError('Fee total exceeds safe integer cents');
  }
  return totalCents;
}
