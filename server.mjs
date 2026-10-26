// 로컬 개발 서버 (의존성 없음): node server.mjs  →  http://localhost:3000
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(root, 'public');

// .env.local 이 있으면 읽기 (예: ANTHROPIC_API_KEY=...)
for (const f of ['.env.local', '.env']) {
  const p = path.join(root, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const { default: generate } = await import('./api/generate.js');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.png': 'image/png', '.ico': 'image/x-icon',
};

function shim(res) {
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { res.setHeader('content-type', 'application/json; charset=utf-8'); res.end(JSON.stringify(o)); };
  return res;
}

const server = http.createServer(async (req, res) => {
  shim(res);
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/generate') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
    return generate(req, res);
  }
  let file = path.normalize(path.join(pub, decodeURIComponent(url.pathname)));
  if (!file.startsWith(pub)) { res.statusCode = 403; return res.end('Forbidden'); }
  try {
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const data = await readFile(file);
    res.setHeader('content-type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end('Not found');
  }
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => {
  console.log(`생기부 작성 도우미: http://localhost:${port}`);
  console.log(process.env.ANTHROPIC_API_KEY ? 'AI 연결: 켜짐' : 'AI 연결: 꺼짐 (예시 문장 모드)');
});
