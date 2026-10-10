import { randomUUID } from 'node:crypto';
export type InvoiceLine = { sku: string; quantity: number; unitPriceCents: number };
export type Invoice = { id: string; customerId: string; currency: 'EUR' | 'USD'; lines: InvoiceLine[]; totalCents: number; createdAt: string };
export class ValidationError extends Error {}
export function createInvoice(input: unknown): Invoice {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ValidationError('Invoice must be an object');
  const data = input as Record<string, unknown>;
  if (typeof data.customerId !== 'string' || !/^cus_[a-z0-9]{3,32}$/.test(data.customerId)) throw new ValidationError('Invalid customerId');
  if (data.currency !== 'EUR' && data.currency !== 'USD') throw new ValidationError('Unsupported currency');
  if (!Array.isArray(data.lines) || !data.lines.length || data.lines.length > 100) throw new ValidationError('Use 1 to 100 invoice lines');
  let totalCents = 0;
  const lines = data.lines.map((value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationError('Invalid line');
    const line = value as Record<string, unknown>;
    if (typeof line.sku !== 'string' || !/^[A-Z0-9_-]{1,40}$/.test(line.sku)) throw new ValidationError('Invalid SKU');
    if (!Number.isSafeInteger(line.quantity) || (line.quantity as number) < 1 || (line.quantity as number) > 10000) throw new ValidationError('Invalid quantity');
    if (!Number.isSafeInteger(line.unitPriceCents) || (line.unitPriceCents as number) < 0) throw new ValidationError('Price must be nonnegative safe integer cents');
    const quantity = line.quantity as number;
    const unitPriceCents = line.unitPriceCents as number;
    const subtotal = quantity * unitPriceCents;
    if (!Number.isSafeInteger(subtotal) || !Number.isSafeInteger(totalCents + subtotal)) throw new ValidationError('Invoice total exceeds safe integer cents');
    totalCents += subtotal;
    return {sku:line.sku,quantity,unitPriceCents};
  });
  return {id:'inv_'+randomUUID(),customerId:data.customerId,currency:data.currency,lines,totalCents,createdAt:new Date().toISOString()};
}
