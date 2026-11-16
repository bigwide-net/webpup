import { archivesOf, archiveUrl, feedNameOf, loadSite } from '../src/data';

const O = 'https://tim.example';
const feed = (title: string, extra = {}) => JSON.stringify({version: 'https://jsonfeed.org/version/1.1', title, items: [{id: '1', content_text: 'x'}], ...extra});

function mockFetch(files: Record<string, string>) {
    globalThis.fetch = jest.fn(async (url: string) => {
        const text = files[url.replace(O, '')];
        return {ok: text != undefined, status: text != undefined ? 200 : 404, text: async () => text};
    }) as any;
}

describe('feed names', () => {
    it.each([
        ['https://tim.example/feed.json', ''],
        ['/feed.json', ''],
        ['https://tim.example/feed/photos.json', 'photos'],
        ['https://tim.example/feed/feed.000001.json', undefined], // an archive, not a feed
        ['https://tim.example/feed/images.json', undefined],
        ['https://tim.example/feed/a/b.json', undefined],
        ['https://other.example/feed.json', undefined],
        ['https://tim.example/blog.xml', undefined],
    ])('%s → %j', (url, name) => expect(feedNameOf(url, O)).toBe(name));
});

describe('archives', () => {
    it('come from _pups.archive_url, on this site only', () => {
        const json = {version: 'https://jsonfeed.org/version/1.1', items: [], _pups: {archive_url: `${O}/feed/photos/feed.000012.json`}};
        const archives = archivesOf(json, O);
        expect(archives).toEqual({prefix: `${O}/feed/photos/feed.`, newest: 12});
        expect(archiveUrl({url: '', json, archives}, 3)).toBe(`${O}/feed/photos/feed.000003.json`);
        expect(archivesOf({...json, _pups: {archive_url: 'https://cdn.example/feed/feed.000001.json'}}, O)).toBeUndefined();
        expect(archivesOf({...json, _pups: {}}, O)).toBeUndefined();
        expect(archivesOf({...json, _pups: undefined, next_url: `${O}/feed/feed.000001.json`}, O)).toBeUndefined();
    });
});

describe('loadSite', () => {
    it('loads the main feed, the registered feeds of this site and the properties', async () => {
        mockFetch({
            '/.well-known/host-meta.json': JSON.stringify({
                links: [
                    {rel: 'https://bigwide.net/ns/personal-storage', href: `${O}/personal-storage.json`},
                    {rel: 'https://bigwide.net/ns/feed', href: `${O}/feed/photos.json`},
                    {rel: 'https://bigwide.net/ns/feed', href: `${O}/feed.json`},
                    {rel: 'https://bigwide.net/ns/feed', href: 'https://elsewhere.example/feed.json'},
                    {rel: 'https://bigwide.net/ns/feed', href: `${O}/feed/missing.json`},
                ],
                properties: {
                    'https://bigwide.net/ns/name': 'Tim', 'https://bigwide.net/ns/title': ' ', 'https://bigwide.net/ns/avatar': `${O}/pups/images/a.png`,
                    'https://bigwide.net/ns/banner': 'javascript:alert(1)', 'https://bigwide.net/ns/theme-color': '#336699',
                },
            }),
            '/feed.json': feed('Notes', {_pups: {pupsControlled: true, archive_url: `${O}/feed/feed.000002.json`}}),
            '/feed/photos.json': feed('Photos'),
            '/.well-known/about.md': '---\nsummary: Hi there\n---\n# About',
            '/webpup-config.json': '{"embeds":"consent"}',
        });
        const site = await loadSite(O);
        expect(site.feeds.map(f => [f.name, f.json.title, !!f.archives])).toEqual([[undefined, 'Notes', true], ['photos', 'Photos', false]]);
        expect(site.props).toEqual({name: 'Tim', title: undefined, summary: undefined, avatar: `${O}/pups/images/a.png`, banner: undefined, themeColor: '#336699', language: undefined});
        expect(site.about?.summary).toBe('Hi there');
        expect(site.following).toBeUndefined();
        expect(site.config).toEqual({embeds: 'consent', themeSelector: false});
    });

    it('works without host-meta.json and config: /feed.json only, embeds on', async () => {
        mockFetch({'/feed.json': feed('Notes'), '/webpup-config.json': '{"embeds": "maybe"}'});
        const site = await loadSite(O);
        expect(site.feeds.length).toBe(1);
        expect(site.config.embeds).toBe('on');
        expect(site.props.name).toBeUndefined();
    });

    it('loads the pages in the order of host-meta.json, with titles, unique names and hidden ones, and the footer', async () => {
        mockFetch({
            '/.well-known/host-meta.json': JSON.stringify({
                links: [
                    {rel: 'https://bigwide.net/ns/webpup-pages', href: `${O}/pups/pages/Über uns.md`},
                    {rel: 'https://bigwide.net/ns/webpup-pages', href: `${O}/a/imprint.md`, titles: {default: 'Impressum', en: 'Imprint'},
                        properties: {'https://bigwide.net/ns/webpup-hidden': 'true'}},
                    {rel: 'https://bigwide.net/ns/webpup-pages', href: `${O}/b/imprint.md`},
                    {rel: 'https://bigwide.net/ns/webpup-pages', href: `${O}/missing.md`},
                    {rel: 'https://bigwide.net/ns/webpup-pages', href: 'https://elsewhere.example/x.md'},
                ],
                properties: {'https://bigwide.net/ns/webpup-footer': `${O}/pups/footer.md`, 'https://bigwide.net/ns/language': 'en'},
            }),
            '/pups/pages/%C3%9Cber%20uns.md': '# About *us*\n\nText',
            '/a/imprint.md': 'Address',
            '/b/imprint.md': 'No heading',
            '/pups/footer.md': '© Tim',
        });
        const site = await loadSite(O);
        expect(site.pages.map(p => [p.name, p.title, p.hidden])).toEqual([
            ['uber-uns', 'About us', false],
            ['imprint', 'Imprint', true],
            ['imprint-2', 'Imprint', false],
        ]);
        expect(site.footer).toEqual({url: `${O}/pups/footer.md`, markdown: '© Tim'});
    });

    it('shows the theme selector without a webpup-config.json, and with one only if it says so', async () => {
        mockFetch({});
        expect((await loadSite(O)).config.themeSelector).toBe(true);
        mockFetch({'/webpup-config.json': '{}'});
        expect((await loadSite(O)).config.themeSelector).toBe(false);
        mockFetch({'/webpup-config.json': '{"theme-selector": true}'});
        expect((await loadSite(O)).config.themeSelector).toBe(true);
    });
});
