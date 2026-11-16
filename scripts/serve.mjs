// Dev server: webpup from dist/ and the example site from example/ (or --data <dir>), served like a
// PUPS server serves uploads (CORS, CSP sandbox, no-cache). https://tim.example in the data files
// becomes this server's origin.
//
//   node scripts/serve.mjs [--port 8095] [--rewrite] [--no-root] [--theme <file.css>] [--data <dir>] [--config <json>]
//
// --rewrite: /p/* serves index.html (pretty URLs). Without it, only /index.html?show=... works.
// --no-root: / doesn't serve index.html (like a server without an index file).
// --config: the content of /webpup-config.json, e.g. '{"theme-selector": false}' (instead of the data's).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const port = Number(opt('--port') ?? 8095);
const rewrite = args.includes('--rewrite');
const root = !args.includes('--no-root');
const theme = opt('--theme') && path.resolve(opt('--theme'));
const data = path.resolve(opt('--data') ?? path.join(dir, 'example'));
const dist = path.join(dir, 'dist');
const config = opt('--config');
const WEBPUP = ['/index.html', '/webpups.js', '/webpup.css', '/theme.css'];

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.md': 'text/markdown', '.jpeg': 'image/jpeg', '.wav': 'audio/wav', '.txt': 'text/plain',
    '.vcf': 'text/vcard', '.opml': 'text/x-opml', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const TEXT = new Set(['.json', '.md', '.vcf', '.opml', '.svg']);

http.createServer((req, res) => {
    const origin = `http://${req.headers.host}`;
    let p = decodeURIComponent(new URL(req.url, origin).pathname);
    if (p == '/' && root || rewrite && p.startsWith('/p/'))
        p = '/index.html';
    if (p == '/webpup-config.json' && config != undefined) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
        res.end(config);
        return;
    }
    const own = WEBPUP.includes(p) || p.startsWith('/webpup-themes/');
    const file = own ? (p == '/theme.css' && theme ? theme : path.join(dist, p)) : path.join(data, p);
    if (!file.startsWith(own ? (theme && p == '/theme.css' ? theme : dist) : data) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end('{"error":"not_found"}');
        console.log(`404 ${req.url}`);
        return;
    }
    const ext = path.extname(file);
    let body = fs.readFileSync(file);
    const headers = { 'Content-Type': (TYPES[ext] ?? 'application/octet-stream') + (TEXT.has(ext) || own ? '; charset=utf-8' : ''), 'Cache-Control': 'no-cache' };
    if (!own) {
        // As PUPS serves uploads (RFC-6, Serving files).
        Object.assign(headers, { 'Access-Control-Allow-Origin': '*', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': 'sandbox' });
        if (TEXT.has(ext))
            body = body.toString('utf8').replaceAll('https://tim.example', origin);
    }
    res.writeHead(200, headers);
    res.end(body);
}).listen(port, () => {
    console.log(`webpup dev server: http://localhost:${port}/  (data: ${path.relative(process.cwd(), data) || '.'})`);
    console.log(`  /p/* rewrite: ${rewrite ? 'on' : 'off'}, / serves index.html: ${root ? 'yes' : 'no'}${theme ? `, theme: ${theme}` : ''}`);
});
