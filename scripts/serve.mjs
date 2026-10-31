import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../www/', import.meta.url));
const port = Number(process.env.PORT || 4177);
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

createServer((request, response) => {
  let requestPath;
  try {
    requestPath = decodeURIComponent((request.url || '/').split('?')[0]);
  } catch {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Bad request');
    return;
  }
  const requestRelative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const file = resolve(root, requestRelative);
  const pathFromRoot = relative(root, file);
  if (pathFromRoot.startsWith('..') || pathFromRoot === '' || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }
  response.writeHead(200, {
    'Content-Type': types[extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
    'Cross-Origin-Opener-Policy': 'same-origin'
  });
  createReadStream(file).pipe(response);
}).listen(port, '0.0.0.0', () => {
  console.log(`Empire Command Mobile is running at http://localhost:${port}`);
  console.log(`For another device on this Wi-Fi network, use this PC's LAN IP with port ${port}.`);
});
