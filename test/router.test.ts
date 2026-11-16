import { detectUrlStyle, formatRoute, parseRoute, STYLE_KEY, type Route, type UrlStyle } from '../src/router';

const PRETTY: UrlStyle = {pretty: true, root: true};
const PLAIN: UrlStyle = {pretty: false, root: false};

const parse = (url: string) => {
    const u = new URL(url, 'https://tim.example');
    return parseRoute(u.pathname, u.search);
};

describe('routes', () => {
    const cases: [Route, string, string][] = [
        [{page: 'feed'}, '/', '/index.html'],
        [{page: 'about'}, '/p/about', '/index.html?show=about'],
        [{page: 'following'}, '/p/following', '/index.html?show=following'],
        [{page: 'contact'}, '/p/contact', '/index.html?show=contact'],
        [{page: 'feed', archive: 3}, '/p/blog/archive/3', '/index.html?show=blog&mode=archive&page=3'],
        [{page: 'feed', feed: 'photos'}, '/p/feed/photos', '/index.html?show=feed&feed=photos'],
        [{page: 'feed', feed: 'photos', archive: 0}, '/p/feed/photos/archive/0', '/index.html?show=feed&feed=photos&mode=archive&page=0'],
        // Feed names that look like pages or keywords are fine.
        [{page: 'feed', feed: 'about'}, '/p/feed/about', '/index.html?show=feed&feed=about'],
        [{page: 'feed', feed: 'archive', archive: 12}, '/p/feed/archive/archive/12', '/index.html?show=feed&feed=archive&mode=archive&page=12'],
    ];
    it.each(cases)('formats and parses %j', (route, pretty, plain) => {
        expect(formatRoute(route, PRETTY)).toBe(pretty);
        expect(formatRoute(route, PLAIN)).toBe(plain);
        expect(parse(pretty)).toEqual(route);
        expect(parse(plain)).toEqual(route);
    });

    it('uses / for the query style when the server serves index.html there', () => {
        expect(formatRoute({page: 'about'}, {pretty: false, root: true})).toBe('/?show=about');
        expect(formatRoute({page: 'feed'}, {pretty: true, root: false})).toBe('/index.html');
        expect(parse('/?show=about')).toEqual({page: 'about'});
    });

    it('keeps the #fragment of a post', () => {
        expect(formatRoute({page: 'feed', archive: 2}, PRETTY, '#p-1')).toBe('/p/blog/archive/2#p-1');
        expect(formatRoute({page: 'feed'}, PLAIN, 'p-1')).toBe('/index.html#p-1');
    });

    it('accepts /p/, /p/blog and trailing slashes as the home page and its pages', () => {
        expect(parse('/p/')).toEqual({page: 'feed'});
        expect(parse('/p/blog')).toEqual({page: 'feed'});
        expect(parse('/p/about/')).toEqual({page: 'about'});
    });

    it.each(['/p/nope', '/p/about/x', '/p/feed', '/p/feed/Bad_Name', '/p/feed/-x', '/p/feed/images', '/p/blog/archive', '/p/blog/archive/x',
        '/p/blog/page/2', '/p/blog/archive/1234567', '/other.html', '/index.html?show=nope', '/index.html?show=feed',
        '/index.html?show=blog&mode=archive', '/index.html?show=blog&mode=list&page=1'])('rejects %s', url =>
        expect(parse(url)).toEqual({page: 'notfound'}));
});

describe('detectUrlStyle', () => {
    const INDEX = '<!doctype html><html><head><meta name="generator" content="webpup"></head></html>';
    const fetcher = (pages: Record<string, string | number>) => jest.fn(async (url: string) => {
        const page = pages[url] ?? 404;
        return typeof page == 'number' ? {ok: false, status: page, text: async () => ''} : {ok: true, status: 200, text: async () => page};
    }) as unknown as jest.Mock & typeof fetch;

    beforeEach(() => localStorage.clear());

    it('probes /p/webpup-probe and / and remembers the result for 7 days', async () => {
        const f = fetcher({'/p/webpup-probe': INDEX, '/': INDEX});
        expect(await detectUrlStyle('/index.html', f)).toEqual({pretty: true, root: true});
        expect(f).toHaveBeenCalledTimes(2);
        const stored = JSON.parse(localStorage.getItem(STYLE_KEY)!);
        expect(stored.until - Date.now()).toBeGreaterThan(6.9 * 24 * 3600 * 1000);
        // From storage now: no requests.
        expect(await detectUrlStyle('/index.html', f)).toEqual({pretty: true, root: true});
        expect(f).toHaveBeenCalledTimes(2);
    });

    it('sees a plain server: the probe gets a 404 or another page', async () => {
        expect(await detectUrlStyle('/index.html', fetcher({'/': '<html>Some other site</html>'}))).toEqual({pretty: false, root: false});
    });

    it('needs no probe for what the page was loaded from', async () => {
        const f = fetcher({});
        expect(await detectUrlStyle('/p/about', fetcher({'/': INDEX}))).toEqual({pretty: true, root: true});
        localStorage.clear();
        await detectUrlStyle('/', f);
        expect(f.mock.calls.map(c => c[0])).toEqual(['/p/webpup-probe']);
    });

    it('updates a stored result that a /p/ page contradicts', async () => {
        localStorage.setItem(STYLE_KEY, JSON.stringify({pretty: false, root: false, until: Date.now() + 1000}));
        expect(await detectUrlStyle('/p/about', fetcher({}))).toEqual({pretty: true, root: false});
        expect(JSON.parse(localStorage.getItem(STYLE_KEY)!).pretty).toBe(true);
    });

    it('probes again when the stored result expired, and stores nothing after a failed request', async () => {
        localStorage.setItem(STYLE_KEY, JSON.stringify({pretty: true, root: true, until: Date.now() - 1}));
        const f = jest.fn(async () => { throw new TypeError('offline'); }) as unknown as typeof fetch;
        expect(await detectUrlStyle('/index.html', f)).toEqual({pretty: false, root: false});
        expect(JSON.parse(localStorage.getItem(STYLE_KEY)!).until).toBeLessThan(Date.now());
    });
});

describe('page routes', () => {
    it('formats and parses the Pages tab and pages', () => {
        expect(formatRoute({page: 'pages'}, PRETTY)).toBe('/p/pages');
        expect(formatRoute({page: 'pages'}, PLAIN)).toBe('/index.html?show=pages');
        expect(formatRoute({page: 'page', name: 'imprint'}, PRETTY, '#x')).toBe('/p/page/imprint#x');
        expect(formatRoute({page: 'page', name: 'imprint'}, PLAIN)).toBe('/index.html?show=page&name=imprint');
        expect(parse('/p/pages')).toEqual({page: 'pages'});
        expect(parse('/p/page/imprint')).toEqual({page: 'page', name: 'imprint'});
        expect(parse('/index.html?show=page&name=imprint')).toEqual({page: 'page', name: 'imprint'});
    });
    it.each(['/p/page', '/p/page/Imprint', '/p/page/a/b', '/p/pages/x', '/index.html?show=page', '/index.html?show=page&name=-x'])('rejects %s', url =>
        expect(parse(url)).toEqual({page: 'notfound'}));
});
