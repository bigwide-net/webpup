import { attachmentDetails, embedScripts, formatDuration, formatSize, parseJsonFeed, textToHtml, toPost } from '../src/jsonfeed';

const BASE = 'https://tim.example/';

describe('parseJsonFeed', () => {
    it('accepts JSON Feed 1.0 and 1.1 and drops broken items', () => {
        expect(parseJsonFeed('{"version":"https://jsonfeed.org/version/1.1","items":[{"id":"a"},null,3]}')?.items).toEqual([{id: 'a'}]);
        expect(parseJsonFeed('{"version":"https://jsonfeed.org/version/1","items":[]}')).toBeDefined();
    });
    it.each(['', 'nope', '{"items":[]}', '{"version":"https://jsonfeed.org/version/1.1"}', '[]'])('rejects %j', text =>
        expect(parseJsonFeed(text)).toBeUndefined());
});

describe('toPost', () => {
    it('maps the fields postviewer shows', () => {
        const post = toPost({
            id: 'p-1', title: ' Hello ', url: 'https://tim.example/hello', content_html: '<p>Hi</p>', date_published: '2026-11-15T09:12:00Z',
            image: 'https://tim.example/feed/images/a.png', _image: {alt: 'A chain'}, authors: [{name: 'Tim'}, {name: 'Ann'}], tags: ['x'],
            _source: {inReplyTo: 'https://alice.example/feed.xml#post-42'},
            attachments: [{url: 'https://tim.example/feed/media/a.mp3', mime_type: 'audio/mpeg'}],
        }, BASE);
        expect(post).toMatchObject({
            title: 'Hello', link: 'https://tim.example/hello', description: '<p>Hi</p>', pubDate: '2026-11-15T09:12:00Z',
            imageUrl: 'https://tim.example/feed/images/a.png', imageAlt: 'A chain', author: 'Tim, Ann',
            mediaUrl: 'https://tim.example/feed/media/a.mp3', mediaType: 'audio/mpeg',
            inReplyTo: {value: 'https://alice.example/feed.xml#post-42', isPermalink: true},
        });
    });

    it('prefers content_html, then the Markdown of _source, then content_text', () => {
        expect(toPost({content_html: '<p>html</p>', content_text: 'text', _source: {markdown: '**md**'}}, BASE).description).toBe('<p>html</p>');
        expect(toPost({content_text: '**md**', _source: {markdown: '**md**'}}, BASE).description).toContain('<strong>md</strong>');
        expect(toPost({content_text: 'a <b>\n\nb\nc'}, BASE).description).toBe('<p>a &lt;b&gt;</p><p>b<br>c</p>');
    });

    it('uses external_url and an image attachment when there is nothing better', () => {
        const post = toPost({content_text: 'x', external_url: 'https://elsewhere.example/', attachments: [{url: 'https://tim.example/i.png', mime_type: 'image/png'}]}, BASE);
        expect(post.link).toBe('https://elsewhere.example/');
        expect(post.imageUrl).toBe('https://tim.example/i.png');
    });

    it('reads the object form of inReplyTo', () => {
        expect(toPost({content_text: 'x', _source: {inReplyTo: {value: 'abc', isPermaLink: false, feedTitle: 'Alice'}}}, BASE).inReplyTo)
            .toEqual({value: 'abc', isPermalink: false, feedUrl: undefined, feedTitle: 'Alice'});
    });

    it('finds the vendor scripts of embedded posts', () => {
        expect(embedScripts('<blockquote class="twitter-tweet"><p>x</p></blockquote><blockquote data-bluesky-uri="at://x">')).toEqual(['x-widget', 'bluesky-embed']);
        expect(embedScripts('<p>no embeds</p>')).toEqual([]);
    });

    it('textToHtml makes paragraphs', () => expect(textToHtml('one\n\n\ntwo')).toBe('<p>one</p><p>two</p>'));
});

describe('attachment details', () => {
    it('formats durations, sizes and formats', () => {
        expect([formatDuration(6), formatDuration(95), formatDuration(3725)]).toEqual(['0:06', '1:35', '1:02:05']);
        expect([formatSize(900), formatSize(48044), formatSize(43200000)]).toEqual(['900 bytes', '47 KB', '41 MB']);
        expect(attachmentDetails({url: 'https://x/ep.mp3', mime_type: 'audio/mpeg', size_in_bytes: 43200000, duration_in_seconds: 3600}))
            .toEqual(['1:00:00', 'MP3', '41 MB']);
        expect(attachmentDetails({url: 'https://x/notes.pdf', mime_type: 'application/octet-stream'})).toEqual(['PDF']);
        expect(attachmentDetails({url: 'https://x/notes'})).toEqual([]);
    });
});
