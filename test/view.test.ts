import type { Site, SiteFeed } from '../src/data';
import { createConsent } from '../src/posts';
import { renderPage, resolveRoute, siteMarkdown, siteName, tabsOf } from '../src/view';

const O = 'https://tim.example';
const feed = (name: string | undefined, items: object[], extra = {}): SiteFeed =>
    ({name, url: name ? `${O}/feed/${name}.json` : `${O}/feed.json`, json: {version: 'https://jsonfeed.org/version/1.1', title: name ?? 'Notes', items, ...extra}});
const VIDEO = {id: 'v1', title: 'Video', content_html: '<p>x</p><iframe src="https://www.youtube.com/embed/abc"></iframe>'};

function site(over: Partial<Site> = {}): Site {
    return {origin: O, host: 'tim.example', config: {embeds: 'on', themeSelector: false}, props: {}, feeds: [feed(undefined, [VIDEO, {id: 'p2', content_text: 'Hello'}])], pages: [], ...over};
}

function render(s: Site, route: Parameters<typeof renderPage>[2]) {
    const app = document.createElement('div');
    const result = renderPage(app, s, route, {site: s, consent: createConsent(s.config.embeds)}, () => {});
    return {app, result};
}

describe('view', () => {
    it('names the site by title, name, contact card, main feed title, domain', () => {
        expect(siteName(site({props: {title: 'T', name: 'N'}}))).toBe('T');
        expect(siteName(site({props: {name: 'N'}}))).toBe('N');
        expect(siteName(site({contact: {name: 'C', entries: []}}))).toBe('C');
        expect(siteName(site())).toBe('Notes');
        expect(siteName(site({feeds: []}))).toBe('tim.example');
    });

    it('shows the configured avatar and banner, else leaves them empty', () => {
        const {app} = render(site({props: {avatar: `${O}/pups/images/a.png`}}), {page: 'feed'});
        expect(app.querySelector('.wp-avatar img')?.getAttribute('src')).toBe(`${O}/pups/images/a.png`);
        expect(app.querySelector('.wp-banner-plain')).not.toBeNull();
        const empty = render(site(), {page: 'feed'}).app;
        expect(empty.querySelector('.wp-avatar-empty')?.children.length).toBe(0);
    });

    it('has a tab per feed and per SocialSpec file, hidden when there is only one', () => {
        const s = site({feeds: [feed(undefined, []), feed('photos', [])], about: {fields: {}, markdown: 'Hi'}});
        expect(tabsOf(s).map(t => t.label)).toEqual(['Posts', 'photos', 'About']);
        const {app, result} = render(s, {page: 'about'});
        expect(app.querySelector('.wp-tab[aria-current="page"]')?.textContent).toBe('About');
        expect(result.title).toBe('About · Notes');
        expect(app.querySelector('.wp-about')?.textContent).toContain('Hi');
        expect(render(site(), {page: 'feed'}).app.querySelector<HTMLElement>('.wp-tabs')!.hidden).toBe(true);
    });

    it('starts with the first tab when there is no main feed', () => {
        const s = site({feeds: [feed('photos', [])]});
        expect(resolveRoute(s, {page: 'feed'})).toEqual({page: 'feed', feed: 'photos', archive: undefined});
        expect(render(site({feeds: []}), {page: 'feed'}).app.querySelector('.wp-notfound h2')?.textContent).toBe('Nothing published yet');
    });

    it('renders the posts with ids, links and the Follow button', () => {
        const {app, result} = render(site(), {page: 'feed'});
        expect([...app.querySelectorAll('.postCard')].map(c => c.id)).toEqual(['v1', 'p2']);
        expect(app.querySelector('#p2 .wp-post-action')?.getAttribute('href')).toBe('/index.html#p2');
        expect(JSON.parse(app.querySelector<HTMLElement>('[data-follow]')!.dataset.follow!)).toMatchObject({url: `${O}/feed.json`, title: 'Notes', site: 'tim.example'});
        expect(result.feed?.name).toBeUndefined();
    });

    it('shows embeds by default, behind a consent overlay with "consent", and not at all with "off"', () => {
        expect(render(site(), {page: 'feed'}).app.querySelector('iframe')?.getAttribute('src')).toBe('https://www.youtube.com/embed/abc');
        const consent = render(site({config: {embeds: 'consent', themeSelector: false}}), {page: 'feed'}).app;
        expect(consent.querySelector('.embedGateOverlay')).not.toBeNull();
        expect(consent.querySelector('iframe')?.hasAttribute('src')).toBe(false);
        const off = render(site({config: {embeds: 'off', themeSelector: false}}), {page: 'feed'}).app;
        expect(off.querySelector('iframe, .embedGate, .embedGateOverlay')).toBeNull();
        expect(off.querySelector('#v1 .postBody')?.textContent).toContain('x');
    });

    it('says when a page or feed does not exist', () => {
        expect(render(site(), {page: 'contact'}).app.querySelector('.wp-notfound h2')?.textContent).toBe('Page not found');
        expect(render(site(), {page: 'feed', feed: 'nope'}).result.title).toBe('Page not found · Notes');
        expect(render(site(), {page: 'feed', archive: 1}).result.title).toBe('Page not found · Notes'); // no archives
    });

    const page = (name: string, title: string, hidden = false) => ({name, title, hidden, url: `${O}/pups/pages/${name}.md`, markdown: `# ${title}\n\nText of ${name}.`});

    it('makes one listed page a tab of its own, and lists several on the Pages tab; hidden pages on neither', () => {
        expect(tabsOf(site({pages: [page('now', 'Now'), page('imprint', 'Imprint', true)], contact: {entries: []}})).map(t => t.label))
            .toEqual(['Posts', 'Now', 'Contact']);
        const s = site({pages: [page('now', 'Now'), page('uses', 'Uses'), page('imprint', 'Imprint', true)]});
        expect(tabsOf(s).map(t => t.label)).toEqual(['Posts', 'Pages']);
        const list = render(s, {page: 'pages'}).app;
        expect([...list.querySelectorAll('.wp-page-list a')].map(a => a.textContent)).toEqual(['Now', 'Uses']);
        const now = render(s, {page: 'page', name: 'now'});
        expect(now.result.title).toBe('Now · Notes');
        expect(now.app.querySelector('.wp-tab[aria-current]')?.textContent).toBe('Pages');
        expect(now.app.querySelector('.wp-page-back a')?.getAttribute('href')).toBe('/index.html?show=pages');
        const imprint = render(s, {page: 'page', name: 'imprint'}).app;
        expect(imprint.querySelector('.wp-page')?.textContent).toContain('Text of imprint.');
        expect(imprint.querySelector('.wp-tab[aria-current]')).toBeNull();
        expect(imprint.querySelector('.wp-page-back')).toBeNull();
        expect(render(s, {page: 'page', name: 'nope'}).result.title).toBe('Page not found · Notes');
    });

    it('shows the footer on every page, and opens links to the site and its pages in place', () => {
        const s = site({pages: [page('imprint', 'Imprint', true)], footer: {url: `${O}/pups/footer.md`,
            markdown: `© Tim · [Imprint](${O}/pups/pages/imprint.md) · [Feed](/feed.json) · [Other](https://other.example/)`}});
        const links = [...render(s, {page: 'feed'}).app.querySelectorAll<HTMLAnchorElement>('.wp-footer-text a')]
            .map(a => [a.getAttribute('href'), a.getAttribute('target')]);
        expect(links).toEqual([['/index.html?show=page&name=imprint', null], [`${O}/feed.json`, null], ['https://other.example/', '_blank']]);
        expect(siteMarkdown(s, '[x](imprint.md#a)', `${O}/pups/pages/`).querySelector('a')?.getAttribute('href')).toBe('/index.html?show=page&name=imprint#a');
    });

    it('puts the theme selector between the panel and the footer', () => {
        const selector = document.createElement('section');
        const s = site();
        const app = document.createElement('div');
        renderPage(app, s, {page: 'feed'}, {site: s, consent: createConsent('on')}, () => {}, selector);
        expect([...app.children].map(c => c.tagName.toLowerCase())).toEqual(['header', 'nav', 'main', 'section', 'footer']);
    });
});
