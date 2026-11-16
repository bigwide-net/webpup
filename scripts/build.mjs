// Builds webpup into dist/: index.html, webpups.js, webpup.css, theme.css (empty), and the themes in
// webpup-themes/ (index.json, <id>.css, <id>.jpg thumbnails from themes/thumbs/, see
// scripts/make-thumbnails.mjs). `node scripts/build.mjs debug` keeps the files readable (with a
// source map). No webpup-config.json: without one, the page shows the theme selector.
// The shared libraries (@lib/*: postviewer, socialspec, follow) come from ../lib, a checkout of
// bigwide-net/lib (tsconfig.json).
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lib = path.resolve(dir, '../lib');
const out = path.join(dir, 'dist');
const dev = process.argv[2] == 'debug';

fs.mkdirSync(out, { recursive: true });

await esbuild.build({
    entryPoints: [path.join(dir, 'src/main.ts')],
    outfile: path.join(out, 'webpups.js'),
    bundle: true,
    format: 'iife',
    target: 'es2020',
    minify: !dev,
    sourcemap: dev ? 'inline' : false,
    legalComments: 'none',
    banner: { js: '/* webpup: https://github.com/bigwide-net — MIT license. Includes DOMPurify (Apache-2.0 or MPL-2.0). */' },
    logLevel: 'info',
});

// The post renderer's styles (without its Tailwind utilities: Feed HTML, RFC-2, has no classes),
// the follow dialog's, then webpup's own.
const css = [
    path.join(lib, 'postviewer/css/postviewer.css'),
    path.join(lib, 'follow/css/follow-dialog.css'),
    path.join(dir, 'src/webpup.css'),
].map(f => fs.readFileSync(f, 'utf8')).join('\n');
const { code } = await esbuild.transform(css, { loader: 'css', minify: !dev, target: ['chrome111', 'firefox113', 'safari16.2'] });
fs.writeFileSync(path.join(out, 'webpup.css'), code);

for (const f of ['index.html', 'theme.css'])
    fs.copyFileSync(path.join(dir, 'src', f), path.join(out, f));
fs.rmSync(path.join(out, 'webpup-config.json'), { force: true });

// The themes: index.json lists those with a thumbnail.
const themesOut = path.join(out, 'webpup-themes');
fs.rmSync(themesOut, { recursive: true, force: true });
fs.mkdirSync(themesOut);
const thumbs = path.join(dir, 'themes/thumbs');
const { themes } = JSON.parse(fs.readFileSync(path.join(dir, 'themes/themes.json'), 'utf8'));
const listed = themes.filter(t => fs.existsSync(path.join(thumbs, `${t.id}.jpg`)));
for (const t of themes.filter(t => !listed.includes(t)))
    console.warn(`  no thumbnail for theme ${t.id}: run node scripts/make-thumbnails.mjs`);
for (const t of themes) {
    const { code: themeCss } = await esbuild.transform(fs.readFileSync(path.join(dir, `themes/${t.id}.css`), 'utf8'), { loader: 'css', minify: false });
    fs.writeFileSync(path.join(themesOut, `${t.id}.css`), themeCss);
}
for (const id of ['default', ...listed.map(t => t.id)])
    if (fs.existsSync(path.join(thumbs, `${id}.jpg`)))
        fs.copyFileSync(path.join(thumbs, `${id}.jpg`), path.join(themesOut, `${id}.jpg`));
fs.writeFileSync(path.join(themesOut, 'index.json'), JSON.stringify({ themes: listed }, null, 2) + '\n');

for (const f of fs.readdirSync(out))
    console.log(`  dist/${f}  ${fs.statSync(path.join(out, f)).isDirectory() ? `${fs.readdirSync(path.join(out, f)).length} files` : `${(fs.statSync(path.join(out, f)).size / 1024).toFixed(1)} KB`}`);
