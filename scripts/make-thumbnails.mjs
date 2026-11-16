// Makes the theme thumbnails in themes/thumbs/: a screenshot of the example site's start page with
// each theme (and default.jpg without one), 1000×700 scaled to 400×280. Needs a build in dist/,
// Google Chrome and macOS's sips.
//
//   node scripts/make-thumbnails.mjs [theme ...]
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 8190;
const out = path.join(dir, 'themes/thumbs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'webpup-thumbs-'));
fs.mkdirSync(out, { recursive: true });

const { themes } = JSON.parse(fs.readFileSync(path.join(dir, 'themes/themes.json'), 'utf8'));
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['default', ...themes.map(t => t.id)];

async function serve(id) {
    const args = ['scripts/serve.mjs', '--port', String(PORT), '--config', '{"theme-selector": false}'];
    if (id != 'default')
        args.push('--theme', `themes/${id}.css`);
    const server = spawn(process.execPath, args, { cwd: dir, stdio: ['ignore', 'pipe', 'inherit'] });
    await new Promise((resolve, reject) => {
        server.stdout.on('data', d => String(d).includes('dev server') && resolve());
        server.on('exit', code => reject(new Error(`dev server exited (${code})`)));
    });
    return server;
}

for (const id of ids) {
    const server = await serve(id);
    try {
        const png = path.join(tmp, `${id}.png`);
        execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${path.join(tmp, `chrome-${id}`)}`,
            '--window-size=1000,700', '--virtual-time-budget=5000', `--screenshot=${png}`, `http://localhost:${PORT}/`], { stdio: 'ignore' });
        execFileSync('sips', ['-Z', '400', '-s', 'format', 'jpeg', '-s', 'formatOptions', '78', png, '--out', path.join(out, `${id}.jpg`)], { stdio: 'ignore' });
        console.log(`themes/thumbs/${id}.jpg  ${(fs.statSync(path.join(out, `${id}.jpg`)).size / 1024).toFixed(1)} KB`);
    } finally {
        server.kill();
        await new Promise(r => server.on('exit', r));
    }
}
fs.rmSync(tmp, { recursive: true, force: true });
