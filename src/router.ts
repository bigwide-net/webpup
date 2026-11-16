// The site's URLs and navigation. Two URL styles, for the two kinds of servers webpup runs on:
//
//   pretty (the server rewrites /p/* to /index.html)    query (a plain static server)
//   /                                                   /index.html (or / if the server maps it)
//   /p/about, /p/following, /p/contact                  /index.html?show=about
//   /p/blog/archive/3                                   /index.html?show=blog&mode=archive&page=3
//   /p/feed/photos, /p/feed/photos/archive/3            /index.html?show=feed&feed=photos[&mode=archive&page=3]
//   /p/pages                                            /index.html?show=pages
//   /p/page/imprint                                     /index.html?show=page&name=imprint
//
// Pages are the Markdown files registered in host-meta.json (rel https://bigwide.net/ns/webpup-pages),
// named by their file name. The main feed (/feed.json) is "blog"; named feeds (/feed/<name>.json, RFC-7) are under "feed", so
// a feed can have any name, also "about" or "archive". Archive pages are numbered like the archive
// files (feed.000003.json is page 3), so their URLs never change. A post is its page + #<item id>.
// Both styles are always understood; links use the style the server supports (detectUrlStyle).
//
// Navigation works like Downread's router (t-lib-ui/router): clicks on links to pages of the site
// change the URL with pushState and render the page without loading it again.

export type InfoPage = 'about' | 'following' | 'contact';

/** A page of the site. `{page: 'feed'}` without feed and archive is the home page. */
export type Route =
    | {page: 'feed', feed?: string, archive?: number}
    | {page: InfoPage}
    | {page: 'pages'}
    | {page: 'page', name: string}
    | {page: 'notfound'};

export interface UrlStyle {
    /** The server rewrites /p/* to /index.html. */
    pretty: boolean;
    /** The server serves index.html at /. */
    root: boolean;
}

const INFO_PAGES: InfoPage[] = ['about', 'following', 'contact'];

/** RFC-7 feed names: 1 to 40 lowercase letters, digits and '-', not at the start or end. */
export const isFeedName = (s: string | null | undefined): s is string =>
    !!s && /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(s) && s != 'images' && s != 'media';

/** The name of a page in URLs: its file name without .md, in lowercase letters, digits and '-'. */
export const isPageName = (s: string | null | undefined): s is string => !!s && /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(s);

const archiveNumber = (s: string | null | undefined) => s && /^\d{1,6}$/.test(s) ? Number(s) : undefined;

/** The page of a path and query string, in either URL style. */
export function parseRoute(pathname: string, search: string): Route {
    const notFound: Route = {page: 'notfound'};
    if (pathname.startsWith('/p/')) {
        const [first, ...rest] = pathname.slice(3).split('/').filter(Boolean).map(decodeURIComponent);
        if (!first)
            return {page: 'feed'};
        if (INFO_PAGES.includes(first as InfoPage) || first == 'pages')
            return rest.length ? notFound : {page: first as InfoPage | 'pages'};
        if (first == 'page')
            return rest.length == 1 && isPageName(rest[0]) ? {page: 'page', name: rest[0]} : notFound;
        const feed = first == 'feed' ? rest.shift() : undefined;
        if (first != 'blog' && !isFeedName(feed))
            return notFound;
        if (!rest.length)
            return {page: 'feed', feed};
        const archive = rest[0] == 'archive' && rest.length == 2 ? archiveNumber(rest[1]) : undefined;
        return archive == undefined ? notFound : {page: 'feed', feed, archive};
    }
    if (pathname != '/' && pathname != '/index.html')
        return notFound;
    const q = new URLSearchParams(search);
    const show = q.get('show');
    if (!show)
        return {page: 'feed'};
    if (INFO_PAGES.includes(show as InfoPage) || show == 'pages')
        return {page: show as InfoPage | 'pages'};
    if (show == 'page') {
        const name = q.get('name');
        return isPageName(name) ? {page: 'page', name} : notFound;
    }
    const feed = show == 'feed' ? q.get('feed') : undefined;
    if (show != 'blog' && !isFeedName(feed))
        return notFound;
    if (!q.get('mode'))
        return {page: 'feed', feed: feed ?? undefined};
    const archive = q.get('mode') == 'archive' ? archiveNumber(q.get('page')) : undefined;
    return archive == undefined ? notFound : {page: 'feed', feed: feed ?? undefined, archive};
}

/** The URL of a page (path and query, plus `#hash` if given). */
export function formatRoute(route: Route, style: UrlStyle, hash = ''): string {
    const home = style.root ? '/' : '/index.html';
    const fragment = hash && (hash.startsWith('#') ? hash : '#' + hash);
    if (route.page == 'notfound')
        return home;
    if (route.page == 'page')
        return (style.pretty ? `/p/page/${route.name}` : `${home}?show=page&name=${route.name}`) + fragment;
    if (route.page != 'feed')
        return (style.pretty ? `/p/${route.page}` : `${home}?show=${route.page}`) + fragment;
    const {feed, archive} = route;
    if (!feed && archive == undefined)
        return home + fragment;
    if (style.pretty)
        return (feed ? `/p/feed/${feed}` : '/p/blog') + (archive != undefined ? `/archive/${archive}` : '') + fragment;
    return `${home}?show=${feed ? `feed&feed=${feed}` : 'blog'}${archive != undefined ? `&mode=archive&page=${archive}` : ''}${fragment}`;
}

/** Whether a same-origin path belongs to the site (and is handled without loading the page). */
export const isSitePath = (pathname: string) => pathname == '/' || pathname == '/index.html' || pathname.startsWith('/p/');

/* ---------- Detecting the URL style ---------- */

export const STYLE_KEY = 'webpup.urlStyle';
export const STYLE_MAX_AGE = 7 * 24 * 3600 * 1000;
/** index.html says that it is webpup's: <meta name="generator" content="webpup">. */
const MARKER = /<meta\s+name=["']?generator["']?\s+content=["']?webpup/i;

interface StoredStyle extends UrlStyle {
    until: number;
}

function readStored(): StoredStyle | undefined {
    try {
        const s = JSON.parse(localStorage.getItem(STYLE_KEY) ?? 'null');
        return s && typeof s.pretty == 'boolean' && typeof s.root == 'boolean' && s.until > Date.now() ? s : undefined;
    } catch {
        return undefined;
    }
}

function store(style: UrlStyle): void {
    try {
        localStorage.setItem(STYLE_KEY, JSON.stringify({...style, until: Date.now() + STYLE_MAX_AGE}));
    } catch { /* not remembered: probed again next time */ }
}

/** Whether `path` serves webpup's index.html. Undefined if the request failed (offline...). */
async function servesIndex(path: string, fetchFn: typeof fetch): Promise<boolean | undefined> {
    try {
        const res = await fetchFn(path, {cache: 'no-store', credentials: 'omit'});
        return res.ok && MARKER.test(await res.text());
    } catch {
        return undefined;
    }
}

/** Which URLs the server supports: whether it rewrites /p/* to /index.html (probed with
 *  /p/webpup-probe) and serves index.html at /. A page loaded from such a URL answers it without a
 *  request. The result is kept in localStorage for 7 days. */
export async function detectUrlStyle(pathname: string, fetchFn: typeof fetch = fetch): Promise<UrlStyle> {
    const known = {pretty: pathname.startsWith('/p/'), root: pathname == '/'};
    const stored = readStored();
    if (stored) {
        const style = {pretty: stored.pretty || known.pretty, root: stored.root || known.root};
        if (style.pretty != stored.pretty || style.root != stored.root)
            store(style);
        return style;
    }
    const [pretty, root] = await Promise.all([
        known.pretty || servesIndex('/p/webpup-probe', fetchFn),
        known.root || servesIndex('/', fetchFn),
    ]);
    const style = {pretty: !!pretty, root: !!root};
    if (pretty != undefined && root != undefined)
        store(style);
    return style;
}

/* ---------- Navigation ---------- */

/** `keepScroll`: the link asked to keep the scroll position (data-keep-scroll, the tabs). */
export type RenderFn = (route: Route, hash: string, how: 'load' | 'push' | 'pop', keepScroll: boolean) => void;

let style: UrlStyle = {pretty: false, root: false};
let renderPage: RenderFn | undefined;

/** The URL of a page in the server's style. */
export const href = (route: Route, hash = '') => formatRoute(route, style, hash);

const currentPath = () => location.pathname + location.search + location.hash;

function show(how: 'load' | 'push' | 'pop', keepScroll = false): void {
    const route = parseRoute(location.pathname, location.search);
    // One address per page: switch to the server's URL style, keep the post (#id).
    const canonical = formatRoute(route, style, location.hash);
    if (route.page != 'notfound' && canonical != currentPath())
        history.replaceState(history.state, '', canonical);
    renderPage?.(route, location.hash, how, keepScroll);
}

/** Goes to a page of the site, without loading it again. Scrolls to the top, unless `keepScroll`. */
export function navigate(url: string, keepScroll = false): void {
    if (url == currentPath())
        return;
    history.replaceState({...history.state, scroll: scrollY}, '');
    history.pushState({}, '', url);
    show('push', keepScroll);
}

function onClick(e: MouseEvent): void {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
    const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a || a.hasAttribute('download') || a.target && a.target != '_self')
        return;
    const url = new URL(a.href, location.href);
    if (url.origin != location.origin || !isSitePath(url.pathname))
        return;
    // Another post on the same page: the browser scrolls to it (and fires hashchange).
    if (url.pathname == location.pathname && url.search == location.search && url.hash)
        return;
    e.preventDefault();
    navigate(url.pathname + url.search + url.hash, a.hasAttribute('data-keep-scroll'));
}

/** Starts the router: renders the current page, then every page the visitor goes to. */
export function startRouter(urlStyle: UrlStyle, render: RenderFn): void {
    style = urlStyle;
    renderPage = render;
    history.scrollRestoration = 'manual';
    document.addEventListener('click', onClick);
    addEventListener('popstate', () => show('pop'));
    show('load');
}
