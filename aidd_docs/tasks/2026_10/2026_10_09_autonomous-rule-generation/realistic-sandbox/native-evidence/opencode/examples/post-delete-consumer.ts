import { ValidationError } from './invoice.ts';

export function calculateRefundCents(paidCents: number, refundedCents: number): number {
  if (!Number.isSafeInteger(paidCents) || paidCents < 0) {
    throw new ValidationError('Paid amount must be nonnegative safe integer cents');
  }
  if (!Number.isSafeInteger(refundedCents) || refundedCents < 0) {
    throw new ValidationError('Refunded amount must be nonnegative safe integer cents');
  }
  if (refundedCents > paidCents) {
    throw new ValidationError('Refunded amount cannot exceed paid amount');
  }
  return paidCents - refundedCents;
}
