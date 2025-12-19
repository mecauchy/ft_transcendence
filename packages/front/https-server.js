#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import url from 'url';
import http from 'http';
import https from 'https';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opts = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const key = args[i].replace(/^--/, '');
    const val = args[i+1] && !args[i+1].startsWith('--') ? args[++i] : true;
    opts[key] = val;
  }
}
const PORT = process.env.PORT || opts.port || 3005;
const DIST = path.resolve('/app/dist');

const mime = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
  '.wasm': 'application/wasm'
};

function sendFile(res, filePath) {
  const ext = path.extname(filePath);
  const type = mime[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('Internal Server Error');
      return;
    }
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

function requestHandler(req, res) {
  try {
    const parsed = url.parse(req.url);
    let pathname = decodeURIComponent(parsed.pathname || '/');
    if (pathname === '/') pathname = '/index.html';
    const filePath = path.join(DIST, pathname);
    if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
      sendFile(res, filePath);
      return;
    }
    // SPA fallback to index.html
    const indexFile = path.join(DIST, 'index.html');
    if (fs.existsSync(indexFile)) {
      sendFile(res, indexFile);
      return;
    }
    res.writeHead(404);
    res.end('Not Found');
  } catch (e) {
    res.writeHead(500);
    res.end('Server Error');
  }
}

if (opts.https || opts.cert) {
  const certPath = opts.cert;
  const keyPath = opts.key;
  if (!certPath || !keyPath) {
    console.error('HTTPS requested but --cert or --key missing');
    process.exit(1);
  }
  const cert = fs.readFileSync(certPath);
  const key = fs.readFileSync(keyPath);
  const server = https.createServer({ key, cert }, requestHandler);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Listening (HTTPS) on ${PORT}`);
  });
} else {
  const server = http.createServer(requestHandler);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Listening (HTTP) on ${PORT}`);
  });
}
