'use strict';
// Static preview of the current web assets (without the AI backend).
// This server has no Android bridge and cannot block other applications.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '../web');
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  console.error('PORT must be an integer between 1024 and 65535.');
  process.exit(1);
}
const types = { '.webp':'image/webp', '.json':'application/json; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return;
  }
  try {
    const pathname = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${port}`).pathname);
    if (pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    const body = await fs.readFile(file);
    res.writeHead(200, {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (err) {
    res.writeHead(err.code === 'ENOENT' ? 404 : 400);
    res.end('File not found or invalid request.');
  }
});
server.on('error', err => { console.error(err.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => {
  console.log(`Unlock English preview: http://127.0.0.1:${port}`);
  console.log('Browser preview only. Native Android focus restrictions are unavailable here.');
  console.log('Press Ctrl+C to stop.');
});
