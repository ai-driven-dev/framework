import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createInvoice, ValidationError } from '../domain/invoice.ts';
import { InvoiceStore } from '../domain/invoice-store.ts';
async function readJson(request: IncomingMessage): Promise<unknown> {
  let text = '';
  for await (const chunk of request) {
    text += chunk.toString('utf8');
    if (Buffer.byteLength(text) > 65536) throw new ValidationError('Request body too large');
  }
  try { return JSON.parse(text); } catch { throw new ValidationError('Malformed JSON'); }
}
export function createApp(store = new InvoiceStore()) {
  return createServer(async (request: IncomingMessage, response: ServerResponse) => {
    function send(status: number, body: unknown) { response.writeHead(status, {'content-type':'application/json'}); response.end(JSON.stringify(body)); }
    try {
      const url = new URL(request.url || '/', 'http://localhost');
      if (request.method === 'GET' && url.pathname === '/health') { send(200,{status:'ok'}); return; }
      if (request.method === 'POST' && url.pathname === '/invoices') {
        if (!request.headers['content-type']?.startsWith('application/json')) { send(415,{error:'Use application/json'}); return; }
        const invoice = createInvoice(await readJson(request)); store.save(invoice);
        response.setHeader('location','/invoices/'+invoice.id); send(201,invoice); return;
      }
      if (request.method === 'GET' && url.pathname.startsWith('/invoices/')) {
        const invoice = store.find(url.pathname.slice('/invoices/'.length));
        if (!invoice) { send(404,{error:'Invoice not found'}); return; }
        send(200,invoice); return;
      }
      send(404,{error:'Route not found'});
    } catch (error) {
      if (error instanceof ValidationError) send(422,{error:error.message});
      else send(500,{error:'Internal server error'});
    }
  });
}
