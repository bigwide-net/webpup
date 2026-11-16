// Loads what the site shows, all from its own origin: /.well-known/host-meta.json (the feeds and the
// site's properties), the SocialSpec files, the feeds' JSON files (archives on demand) and the
// optional /webpup-config.json.
import { parseAbout, type About } from '@lib/socialspec/src/about';
import { httpUrl } from '@lib/socialspec/src/domain';
import { parseOpml, type FollowEntry } from '@lib/socialspec/src/opml';
import { parseVcard, type Contact } from '@lib/socialspec/src/vcard';
import { parseJsonFeed, type JsonFeed } from './jsonfeed';
import { isFeedName } from './router';

export const FEED_REL = 'https://bigwide.net/ns/feed';
/** Links to Markdown files that webpup shows as pages, in the order of the links. A link with the
 *  property HIDDEN_PROP "true" is a page that is only linked (e.g. an imprint, from the footer): it
 *  is neither a tab nor on the Pages tab. */
export const PAGES_REL = 'https://bigwide.net/ns/webpup-pages';
export const HIDDEN_PROP = 'https://bigwide.net/ns/webpup-hidden';
const NS = 'https://bigwide.net/ns/';

/** The host-meta.json properties webpup uses (RFC-6, The list of well-known paths). */
export interface SiteProps {
    name?: string;
    title?: string;
    summary?: string;
    /** URLs of images in /pups/images/. */
    avatar?: string;
    banner?: string;
    themeColor?: string;
    language?: string;
    /** URL of a Markdown file shown at the bottom of every page (https://bigwide.net/ns/webpup-footer). */
    footer?: string;
}

/** webpup-config.json. embeds: 'on' shows embedded videos and posts at once, 'consent' after the
 *  visitor allowed the service (remembered in the browser), 'off' never. themeSelector
 *  ("theme-selector"): the row of themes to try at the bottom of the page. On while the site has no
 *  webpup-config.json, so a new site shows it; a config file turns it off unless it says true. */
export interface Config {
    embeds: 'on' | 'consent' | 'off';
    themeSelector: boolean;
}

/** A Markdown file of the site: a page, or the footer. */
export interface MarkdownFile {
    url: string;
    markdown: string;
}

export interface SitePage extends MarkdownFile {
    /** Its name in URLs (router isPageName). */
    name: string;
    title: string;
    /** Not listed: only reachable by links. */
    hidden: boolean;
}

export interface SiteFeed {
    /** The name of a named feed (/feed/<name>.json), undefined for the main feed (/feed.json). */
    name?: string;
    url: string;
    json: JsonFeed;
    /** From _pups.archive_url: the archives' URL without the number, and the newest's number. */
    archives?: {prefix: string, newest: number};
}

export interface Site {
    origin: string;
    host: string;
    config: Config;
    props: SiteProps;
    /** The main feed first, then the other feeds in the order of host-meta.json. */
    feeds: SiteFeed[];
    about?: About;
    following?: FollowEntry[];
    contact?: Contact;
    /** In the order of host-meta.json. */
    pages: SitePage[];
    footer?: MarkdownFile;
}

/** The text of a file of the site; undefined if it doesn't exist or can't be read. */
async function getText(url: string, accept: string): Promise<string | undefined> {
    try {
        const res = await fetch(url, {headers: {Accept: accept}, credentials: 'omit', cache: 'no-cache'});
        if (res.ok)
            return await res.text();
        if (res.status != 404 && res.status != 410)
            console.warn(`webpup: ${url}: HTTP ${res.status}`);
    } catch (e) {
        console.warn(`webpup: ${url}:`, e);
    }
    return undefined;
}

/** The feed name of a feed URL of this site: '' for /feed.json, the name for /feed/<name>.json.
 *  Undefined for anything else, also for feeds on other hosts: webpup shows only the site's own
 *  feeds, as RFC-7 lays them out. */
export function feedNameOf(url: string, origin: string): string | undefined {
    let u: URL;
    try {
        u = new URL(url, origin);
    } catch {
        return undefined;
    }
    if (u.origin != origin)
        return undefined;
    if (u.pathname == '/feed.json')
        return '';
    const name = /^\/feed\/([^/]+)\.json$/.exec(u.pathname)?.[1];
    return isFeedName(name) ? name : undefined;
}

const ARCHIVE = /^(.*\/feed\.)(\d{6})\.json$/;

/** The archives of a feed with _pups.archive_url (RFC-7): feed.000000.json... in its directory. */
export function archivesOf(json: JsonFeed, origin: string): SiteFeed['archives'] {
    const url = httpUrl(json._pups?.archive_url, origin);
    const m = url && new URL(url).origin == origin ? ARCHIVE.exec(url) : undefined;
    return m ? {prefix: m[1], newest: Number(m[2])} : undefined;
}

export const archiveUrl = (feed: SiteFeed, n: number) => `${feed.archives!.prefix}${String(n).padStart(6, '0')}.json`;

const archiveCache = new Map<string, Promise<JsonFeed | undefined>>();

/** Archive `n` of a feed; undefined if it doesn't exist. Loaded once per page view. */
export function loadArchive(feed: SiteFeed, n: number): Promise<JsonFeed | undefined> {
    const url = archiveUrl(feed, n);
    let p = archiveCache.get(url);
    if (!p) {
        p = getText(url, 'application/feed+json, application/json').then(t => t ? parseJsonFeed(t) : undefined);
        archiveCache.set(url, p);
    }
    return p;
}

interface HostMetaLink {
    rel?: string;
    href?: string;
    titles?: Record<string, unknown>;
    properties?: Record<string, unknown>;
}

interface HostMeta {
    links?: HostMetaLink[];
    properties?: Record<string, unknown>;
}

/** An http(s) URL of this site, without its #fragment; undefined for anything else. */
function ownUrl(url: string | undefined, origin: string): string | undefined {
    const u = httpUrl(url, origin);
    return u && new URL(u).origin == origin ? u.replace(/#.*$/, '') : undefined;
}

function propsOf(hm: HostMeta | undefined, origin: string): SiteProps {
    const p = hm?.properties && typeof hm.properties == 'object' ? hm.properties : {};
    const get = (key: string) => typeof p[NS + key] == 'string' ? (p[NS + key] as string).trim() || undefined : undefined;
    return {
        name: get('name'),
        title: get('title'),
        summary: get('summary'),
        avatar: httpUrl(get('avatar'), origin),
        banner: httpUrl(get('banner'), origin),
        themeColor: get('theme-color'),
        language: get('language'),
        footer: ownUrl(get('webpup-footer'), origin),
    };
}

function configOf(text: string | undefined): Config {
    let json: any;
    try {
        json = text != undefined ? JSON.parse(text) : undefined;
    } catch {
        console.warn('webpup: webpup-config.json is not valid JSON');
    }
    return {
        embeds: ['on', 'consent', 'off'].includes(json?.embeds) ? json.embeds : 'on',
        themeSelector: text == undefined || json?.['theme-selector'] == true,
    };
}

/** "imprint" for .../imprint.md: the page's name in URLs. */
const nameOfPage = (url: string) =>
    decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '').replace(/\.(md|markdown|txt)$/i, '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64).replace(/-+$/, '') || 'page';

/** The page's title: the link's `titles` (RFC 6415; the page's language, else "default", else
 *  any), else its first heading, else its name. */
function titleOfPage(link: HostMetaLink, markdown: string, name: string, language?: string): string {
    const titles = link.titles && typeof link.titles == 'object' ? link.titles : {};
    const pick = (k: string | undefined) => k && typeof titles[k] == 'string' ? (titles[k] as string).trim() : '';
    const heading = /^#{1,6}[ \t]+(.+?)[ \t#]*$/m.exec(markdown)?.[1];
    return pick(language) || pick('default') || Object.values(titles).find((t): t is string => typeof t == 'string' && !!t.trim())?.trim()
        || heading?.replace(/[*_`]/g, '').trim() || name.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase());
}

const MD_ACCEPT = 'text/markdown, text/plain;q=0.9';

/** The pages registered in host-meta.json, loaded. Unique names: a second imprint.md is imprint-2. */
async function loadPages(hostMeta: HostMeta | undefined, origin: string, language?: string): Promise<SitePage[]> {
    const links = (Array.isArray(hostMeta?.links) ? hostMeta!.links : []).filter(l => l?.rel == PAGES_REL);
    const urls = new Set<string>();
    const found = links.map(link => ({link, url: ownUrl(link.href, origin)}))
        .filter((p): p is {link: HostMetaLink, url: string} => !!p.url && !urls.has(p.url) && !!urls.add(p.url));
    const texts = await Promise.all(found.map(p => getText(p.url, MD_ACCEPT)));
    const names = new Set<string>();
    const pages: SitePage[] = [];
    found.forEach(({link, url}, i) => {
        const markdown = texts[i];
        if (markdown == undefined)
            return;
        let name = nameOfPage(url);
        for (let n = 2; names.has(name); n++)
            name = `${nameOfPage(url).slice(0, 60)}-${n}`;
        names.add(name);
        const hidden = String(link.properties && typeof link.properties == 'object' ? link.properties[HIDDEN_PROP] : '').trim().toLowerCase() == 'true';
        pages.push({name, url, markdown, title: titleOfPage(link, markdown, nameOfPage(url), language), hidden});
    });
    return pages;
}

function parseJson<T>(text: string | undefined): T | undefined {
    try {
        return text ? JSON.parse(text) : undefined;
    } catch {
        return undefined;
    }
}

const FEED_ACCEPT = 'application/feed+json, application/json';

/** Loads everything but the archives, in parallel. */
export async function loadSite(origin = location.origin): Promise<Site> {
    const [hostMetaText, configText, aboutText, followingText, contactText, mainText] = await Promise.all([
        getText(`${origin}/.well-known/host-meta.json`, 'application/json'),
        getText(`${origin}/webpup-config.json`, 'application/json'),
        getText(`${origin}/.well-known/about.md`, 'text/markdown, text/plain;q=0.9'),
        getText(`${origin}/.well-known/following.opml`, 'text/x-opml, application/xml;q=0.9'),
        getText(`${origin}/.well-known/contact.vcf`, 'text/vcard, text/plain;q=0.9'),
        getText(`${origin}/feed.json`, FEED_ACCEPT),
    ]);
    const hostMeta = parseJson<HostMeta>(hostMetaText);
    const props = propsOf(hostMeta, origin);
    const pagesLoading = loadPages(hostMeta, origin, props.language);
    const footerLoading = props.footer ? getText(props.footer, MD_ACCEPT) : Promise.resolve(undefined);

    // The main feed is at /feed.json, registered or not (RFC-7, Reading); the named feeds come
    // from host-meta.json.
    const names = new Set<string>();
    for (const link of Array.isArray(hostMeta?.links) ? hostMeta!.links : [])
        if (link?.rel == FEED_REL && typeof link.href == 'string') {
            const name = feedNameOf(link.href, origin);
            if (name)
                names.add(name);
        }
    const named = await Promise.all([...names].map(async name => {
        const url = `${origin}/feed/${name}.json`;
        const text = await getText(url, FEED_ACCEPT);
        const json = text ? parseJsonFeed(text) : undefined;
        if (text && !json)
            console.warn(`webpup: ${url} is not a JSON Feed`);
        return json && {name, url, json};
    }));
    const main = mainText ? parseJsonFeed(mainText) : undefined;
    const feeds = [main && {url: `${origin}/feed.json`, json: main}, ...named]
        .filter((f): f is Omit<SiteFeed, 'archives'> => !!f)
        .map(f => ({...f, archives: archivesOf(f.json, origin)}));

    const about = aboutText != undefined ? parseAbout(aboutText) : undefined;
    const [pages, footerText] = await Promise.all([pagesLoading, footerLoading]);
    return {
        origin,
        host: new URL(origin).host,
        config: configOf(configText),
        props,
        feeds,
        pages,
        footer: props.footer && footerText != undefined ? {url: props.footer, markdown: footerText} : undefined,
        about,
        following: followingText != undefined ? parseOpml(followingText, origin + '/') : undefined,
        contact: contactText != undefined ? parseVcard(contactText) : undefined,
    };
}

export const feedOfRoute = (site: Site, name: string | undefined) => site.feeds.find(f => f.name == name);
