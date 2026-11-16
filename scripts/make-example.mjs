// Writes the example site in example/: host-meta.json with the site's properties, the SocialSpec
// files, a main feed with three archives (RFC-7) and a named feed without archives. Its URLs use
// https://tim.example, which scripts/serve.mjs replaces with its own origin.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../example');
const O = 'https://tim.example';
const write = (file, content) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), typeof content == 'string' || Buffer.isBuffer(content) ? content : JSON.stringify(content, null, 2) + '\n');
};
const RFC7 = 'https://github.com/bigwide-net/RFCs/blob/main/RFC-7-Feed-Publishing-with-PUPS.md';

write('.well-known/host-meta.json', {
    links: [
        { rel: 'https://bigwide.net/ns/personal-storage', type: 'application/json', href: `${O}/personal-storage.json` },
        { rel: 'https://bigwide.net/ns/feed', type: 'application/feed+json', href: `${O}/feed.json` },
        { rel: 'https://bigwide.net/ns/feed', type: 'application/feed+json', href: `${O}/feed/photos.json` },
        { rel: 'https://bigwide.net/ns/feed', type: 'application/rss+xml', href: 'https://elsewhere.example/rss.xml' },
        // Pages, in this order. The imprint is hidden: only the footer links it.
        { rel: 'https://bigwide.net/ns/webpup-pages', type: 'text/markdown', href: `${O}/pups/pages/now.md` },
        { rel: 'https://bigwide.net/ns/webpup-pages', type: 'text/markdown', href: `${O}/pups/pages/uses.md`, titles: { default: 'Uses' } },
        { rel: 'https://bigwide.net/ns/webpup-pages', type: 'text/markdown', href: `${O}/pups/pages/imprint.md`,
            properties: { 'https://bigwide.net/ns/webpup-hidden': 'true' } },
    ],
    properties: {
        'https://bigwide.net/ns/name': 'Tim Example',
        'https://bigwide.net/ns/summary': 'Notes on feeds, the open web, and long walks.',
        'https://bigwide.net/ns/avatar': `${O}/pups/images/avatar.svg`,
        'https://bigwide.net/ns/banner': `${O}/pups/images/banner.svg`,
        'https://bigwide.net/ns/language': 'en',
        'https://bigwide.net/ns/webpup-footer': `${O}/pups/pages/footer.md`,
    },
});

write('pups/pages/now.md', `# What I'm doing now

Updated November 2026.

- Walking the river trail every morning
- Writing about [feeds and archives](/feed.json)
- Reading *The Dawn of Everything*
`);
write('pups/pages/uses.md', `# The tools I use

This site is a [JSON Feed](https://www.jsonfeed.org/) and three SocialSpec files, written by apps
through a Personal Upload Server, and shown by webpup.

| What | Tool |
| --- | --- |
| Writing | Downread |
| Hosting | A $2 PHP host |
`);
write('pups/pages/imprint.md', `# Imprint

Tim Example  
Example Street 1  
12345 Example City

Email: tim@tim.example
`);
write('pups/pages/footer.md', `© 2026 Tim Example · [Imprint](${O}/pups/pages/imprint.md) · [Now](/pups/pages/now.md)
`);

write('pups/images/avatar.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#e9c46a"/><circle cx="100" cy="82" r="38" fill="#264653"/><path d="M30 200c8-48 38-72 70-72s62 24 70 72z" fill="#264653"/></svg>\n`);
write('pups/images/banner.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 500" preserveAspectRatio="xMidYMid slice"><rect width="1500" height="500" fill="#2a9d8f"/><path d="M0 380 L300 210 L520 330 L800 150 L1100 320 L1300 220 L1500 300 V500 H0z" fill="#264653"/><path d="M0 440 L400 330 L700 420 L1000 340 L1500 430 V500 H0z" fill="#1d3640"/><circle cx="1210" cy="120" r="54" fill="#e9c46a"/></svg>\n`);
write('feed/images/2026/trail.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675"><rect width="1200" height="675" fill="#a8dadc"/><path d="M0 500 Q300 380 600 470 T1200 430 V675 H0z" fill="#457b9d"/><path d="M520 675 C560 560 640 520 700 470" stroke="#f1faee" stroke-width="22" fill="none"/></svg>\n`);
for (const [i, color] of ['#e76f51', '#f4a261', '#2a9d8f', '#8ab17d'].entries())
    write(`feed/photos/images/photo-${i}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="${color}"/><circle cx="${300 + i * 200}" cy="300" r="140" fill="#fff" opacity="0.5"/></svg>\n`);

write('.well-known/about.md', `---
summary: Writer, walker, feed enthusiast.
---
## About me

I write about **feeds**, the open web, and the joy of taking the long way home. This site is
published with a [Personal Upload Server](https://github.com/bigwide-net/RFCs): the posts are a
JSON Feed, the profile is three files in \`/.well-known/\`.

- Based somewhere with good trails
- Reading: *The Dawn of Everything*
- Writing: this blog, slowly

![Out on the trail](/feed/images/2026/trail.svg)
`);

write('.well-known/contact.vcf', `BEGIN:VCARD\r\nVERSION:4.0\r\nFN:Tim Example\r\nEMAIL;PREF=1:tim@tim.example\r\nURL:${O}/\r\nX-SOCIALPROFILE;TYPE=mastodon:https://mastodon.example/@tim\r\nEND:VCARD\r\n`);

write('.well-known/following.opml', `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Tim follows</title></head>
  <body>
    <outline text="Alice Writes" type="rss" xmlUrl="https://alice.example/feed.json" htmlUrl="https://alice.example/"/>
    <outline text="Bob's Notes" type="rss" xmlUrl="https://bob.example/feed.xml" htmlUrl="https://bob.example/"/>
    <outline text="Carol on Code" type="rss" xmlUrl="https://carol.example/atom.xml" htmlUrl="https://carol.example/"/>
    <outline text="Dave's Garden" type="link" url="https://dave.example/"/>
  </body>
</opml>
`);

// A podcast episode (post 46): a short generated chime as WAV (8 kHz, 8 bit, mono), and a transcript.
const RATE = 8000, SECONDS = 6;
const samples = Buffer.alloc(RATE * SECONDS);
for (let i = 0; i < samples.length; i++) {
    const t = i / RATE;
    const v = [523.25, 659.25, 783.99, 1046.5].reduce((sum, f, k) => {
        const start = k * 0.6;
        return t < start ? sum : sum + Math.sin(2 * Math.PI * f * (t - start)) * Math.exp(-(t - start) * 1.6) * 0.22;
    }, 0);
    samples[i] = Math.round(128 + 127 * Math.max(-1, Math.min(1, v)));
}
const wavHeader = Buffer.alloc(44);
wavHeader.write('RIFF', 0); wavHeader.writeUInt32LE(36 + samples.length, 4); wavHeader.write('WAVEfmt ', 8);
wavHeader.writeUInt32LE(16, 16); wavHeader.writeUInt16LE(1, 20); wavHeader.writeUInt16LE(1, 22); wavHeader.writeUInt32LE(RATE, 24);
wavHeader.writeUInt32LE(RATE, 28); wavHeader.writeUInt16LE(1, 32); wavHeader.writeUInt16LE(8, 34); wavHeader.write('data', 36); wavHeader.writeUInt32LE(samples.length, 40);
const wav = Buffer.concat([wavHeader, samples]);
write('feed/media/episode-1.wav', wav);
const transcript = `Episode 1: Why feeds still matter\n\n[chime]\n\nThat's all for today. Thanks for listening.\n`;
write('feed/media/episode-1-transcript.txt', transcript);
const episode = base => ({ ...base, title: 'Episode 1: Why feeds still matter',
    content_html: '<p>The first episode of a very short podcast: a chime, and a transcript to go with it.</p>',
    attachments: [
        { url: `${O}/feed/media/episode-1.wav`, mime_type: 'audio/wav', size_in_bytes: wav.length, duration_in_seconds: SECONDS },
        { url: `${O}/feed/media/episode-1-transcript.txt`, mime_type: 'text/plain', title: 'Transcript', size_in_bytes: Buffer.byteLength(transcript) },
    ] });

// The main feed: 47 posts, newest first. Archives hold 20 each, the newest (000002) holds 7.
const TOTAL = 47;
const date = i => new Date(Date.UTC(2026, 10, 15, 9, 30) - i * 2 * 86400000).toISOString().replace('.000', '');
const item = i => {
    const n = TOTAL - i; // post number, 1 = oldest
    const id = `p-${String(n).padStart(4, '0')}-exampleXyz9`;
    const base = { id, date_published: date(i) };
    if (n == 46)
        return episode(base);
    switch ((n + 3) % 7) { // the newest post has an image
        case 0: return { ...base, content_text: `Short note #${n}: a post without a title, like a microblog.\n\nIt has two paragraphs.` };
        case 1: return { ...base, title: `A walk along the river (${n})`, image: `${O}/feed/images/2026/trail.svg`, _image: { alt: 'A trail by the water' },
            content_html: `<p>Post ${n}. The trail follows the river for a few miles, then climbs.</p><p>More text, with a <a href="https://example.org/">link</a>.</p>`, tags: ['walking', 'outdoors'] };
        case 2: return { ...base, title: `Feeds are the open web's API (${n})`, content_html: `<p>Post ${n}. Every site can have a feed, and every reader can read it.</p><blockquote><p>The best API is a file.</p></blockquote><ul><li>No accounts</li><li>No algorithm</li></ul>` };
        case 3: return { ...base, title: `Written in Markdown (${n})`, content_text: `Post ${n} in **Markdown**.`, _source: { markdown: `Post ${n}, written in **Markdown**, with a [link](https://example.org/) and a list:\n\n- one\n- two` } };
        case 4: return { ...base, content_html: `<p>Replying to Alice: agreed, archives don't need a CMS. (${n})</p>`, _source: { inReplyTo: 'https://alice.example/feed.json#post-42' } };
        case 5: return { ...base, title: `A video I liked (${n})`, content_html: `<p>Post ${n}.</p><iframe src="https://www.youtube.com/embed/aqz-KE-bpKQ" width="560" height="315" allowfullscreen></iframe>` };
        default: return { ...base, title: `Weekly links (${n})`, url: `https://elsewhere.example/links/${n}`, content_html: `<p>Post ${n}: a few links worth reading.</p><ol><li><a href="https://example.org/a">One</a></li><li><a href="https://example.org/b">Two</a></li></ol>` };
    }
};
const items = Array.from({ length: TOTAL }, (_, i) => item(i));
const fields = { version: 'https://jsonfeed.org/version/1.1', title: 'Tim’s Notes', home_page_url: `${O}/`, description: 'Notes on feeds and the web.',
    authors: [{ name: 'Tim Example', url: `${O}/` }], language: 'en' };
const archiveCount = Math.ceil(TOTAL / 20);
const oldestFirst = [...items].reverse();
for (let a = 0; a < archiveCount; a++)
    write(`feed/feed.${String(a).padStart(6, '0')}.json`, { ...fields, feed_url: `${O}/feed/feed.${String(a).padStart(6, '0')}.json`,
        ...(a ? { next_url: `${O}/feed/feed.${String(a - 1).padStart(6, '0')}.json` } : {}),
        _pups: { about: RFC7, pupsControlled: true, updates_url: `${O}/feed.json` },
        items: oldestFirst.slice(a * 20, a * 20 + 20).reverse() });
write('feed.json', { ...fields, feed_url: `${O}/feed.json`,
    _pups: { about: RFC7, pupsControlled: true, archive_url: `${O}/feed/feed.${String(archiveCount - 1).padStart(6, '0')}.json` },
    items: items.slice(0, 30) });

write('feed/photos.json', { version: 'https://jsonfeed.org/version/1.1', title: 'Photos', home_page_url: `${O}/`, feed_url: `${O}/feed/photos.json`,
    description: 'Pictures from walks. No archives: only the newest photos.', _pups: { about: RFC7, pupsControlled: true },
    items: [0, 1, 2, 3].map(i => ({ id: `ph-${i}-exampleAbcd1234`, title: `Photo ${4 - i}`, date_published: date(i * 3 + 1),
        image: `${O}/feed/photos/images/photo-${i}.svg`, content_html: `<p>Photo ${4 - i} of the series.</p>` })) });

// No webpup-config.json: like a new site, the example shows the theme selector.
console.log('example/ written');
