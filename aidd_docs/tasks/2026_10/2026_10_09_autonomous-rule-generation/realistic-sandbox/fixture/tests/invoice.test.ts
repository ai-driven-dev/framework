import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInvoice, ValidationError } from '../src/domain/invoice.ts';
import { InvoiceStore } from '../src/domain/invoice-store.ts';
const valid = {customerId:'cus_acme',currency:'EUR',lines:[{sku:'CONSULTING',quantity:3,unitPriceCents:1999},{sku:'FREIGHT',quantity:1,unitPriceCents:450}]};
test('exact cents totals and repository isolation', () => {
  const invoice = createInvoice(valid); assert.equal(invoice.totalCents,6447); assert.match(invoice.id,/^inv_/);
  const store = new InvoiceStore(); store.save(invoice); invoice.lines[0].quantity = 900;
  assert.equal(store.find(invoice.id)?.lines[0].quantity,3);
  const found = store.find(invoice.id)!; found.totalCents = 0; assert.equal(store.find(invoice.id)?.totalCents,6447);
});
for (const input of [null,{...valid,customerId:'bad'},{...valid,currency:'GBP'},{...valid,lines:[]},{...valid,lines:[{sku:'X',quantity:0,unitPriceCents:1}]},{...valid,lines:[{sku:'X',quantity:1,unitPriceCents:1.25}]},{...valid,lines:[{sku:'X',quantity:2,unitPriceCents:Number.MAX_SAFE_INTEGER}]}]) test('invalid invoice refuses '+JSON.stringify(input), () => assert.throws(()=>createInvoice(input),ValidationError));
