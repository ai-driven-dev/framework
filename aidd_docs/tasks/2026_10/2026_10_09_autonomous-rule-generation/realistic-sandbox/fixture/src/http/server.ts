import { createApp } from './app.ts';
const server = createApp();
server.listen(Number(process.env.PORT || 3000), '127.0.0.1', () => console.log('Harbor invoice API ready'));
