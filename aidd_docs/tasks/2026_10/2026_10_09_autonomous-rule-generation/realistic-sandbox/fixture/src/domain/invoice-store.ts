import type { Invoice } from './invoice.ts';
export class InvoiceStore {
  private invoices = new Map<string, Invoice>();
  save(invoice: Invoice): void { this.invoices.set(invoice.id, structuredClone(invoice)); }
  find(id: string): Invoice | undefined { const invoice = this.invoices.get(id); return invoice ? structuredClone(invoice) : undefined; }
  get size(): number { return this.invoices.size; }
}
