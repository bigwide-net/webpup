// The page: the profile header (banner, avatar, name, summary, Follow), the tabs (the feeds, the
// SocialSpec files that exist and the pages), the current tab's panel, and the footer (the site's
// footer Markdown, the feeds). Like sodir.org's profile
// (lib/socialspec/src/view.ts), but every tab is a page with its own URL, and Posts is a full reader.
import type { FollowFeed } from '@lib/follow/src/follow';
import { addHtml, newHtml } from '@lib/postviewer/src/dom';
import { renderMarkdown } from '@lib/postviewer/src/markdown';
import { icon, type IconName } from '@lib/socialspec/src/icons';
import type { FollowEntry } from '@lib/socialspec/src/opml';
import { preferredEmail, type Contact, type ContactEntry } from '@lib/socialspec/src/vcard';
import { feedOfRoute, type MarkdownFile, type Site, type SiteFeed } from './data';
import { followButton } from './follow';
import { archivePanel, feedRoute, feedTitle, latestPanel, type PostContext } from './posts';
import { href, type InfoPage, type Route } from './router';

/** The site's name: its title, the owner's name, the contact card's name, the main feed's title or
 *  the domain. */
export const siteName = (s: Site) =>
    s.props.title || s.props.name || s.contact?.name || s.feeds.find(f => !f.name)?.json.title?.trim() || s.host;

export const siteSummary = (s: Site) =>
    s.props.summary || s.about?.summary || s.feeds.find(f => !f.name)?.json.description?.trim() || undefined;

const external = (url: string, attrs: Record<string, string> = {}, children?: (Node | string)[] | Node | string) =>
    newHtml('a', {href: url, target: '_blank', rel: 'noopener', ...attrs}, children);

/* ---------- Tabs ---------- */

interface Tab {
    route: Route;
    label: string;
}

const INFO_TABS: {page: InfoPage, label: string}[] = [
    {page: 'following', label: 'Following'},
    {page: 'about', label: 'About'},
    {page: 'contact', label: 'Contact'},
];

const hasInfo = (s: Site, page: InfoPage) => page == 'about' ? !!s.about : page == 'following' ? !!s.following : !!s.contact;

/** The pages that are listed (not hidden), in the order of host-meta.json. */
const listedPages = (s: Site) => s.pages.filter(p => !p.hidden);

/** One listed page is a tab of its own, like About; several are listed on the Pages tab. */
function pagesTab(s: Site): Tab[] {
    const pages = listedPages(s);
    if (pages.length == 1)
        return [{route: {page: 'page', name: pages[0].name}, label: pages[0].title}];
    return pages.length ? [{route: {page: 'pages'}, label: 'Pages'}] : [];
}

export function tabsOf(s: Site): Tab[] {
    const info = INFO_TABS.filter(t => hasInfo(s, t.page)).map(t => ({route: {page: t.page} as Route, label: t.label}));
    const contact = info.findIndex(t => t.route.page == 'contact');
    return [
        ...s.feeds.map(f => ({route: feedRoute(f), label: f.name ? feedTitle(f) : 'Posts'})),
        // Following, About, the pages, Contact
        ...contact < 0 ? [...info, ...pagesTab(s)] : [...info.slice(0, contact), ...pagesTab(s), ...info.slice(contact)],
    ];
}

/** The page a route shows. The home page is the main feed; without one, the first tab. */
export function resolveRoute(s: Site, route: Route): Route | undefined {
    if (route.page == 'feed' && !route.feed && route.archive == undefined && !feedOfRoute(s, undefined))
        return tabsOf(s)[0]?.route;
    return route;
}

/** Whether the tab `tab` is the one of the page `page` (a listed page belongs to the Pages tab;
 *  hidden pages to none). */
const sameTab = (s: Site, tab: Route, page: Route) =>
    tab.page == 'pages' ? page.page == 'pages' || page.page == 'page' && listedPages(s).some(p => p.name == page.name)
    : tab.page == 'page' ? page.page == 'page' && page.name == tab.name
    : tab.page == page.page && (tab.page != 'feed' || page.page == 'feed' && tab.feed == page.feed);

function tabBar(s: Site, current: Route): HTMLElement {
    const nav = newHtml('nav', {class: 'wp-tabs', 'aria-label': 'Sections'});
    const tabs = tabsOf(s);
    if (tabs.length < 2)
        nav.hidden = true;
    for (const t of tabs)
        // Switching tabs keeps the scroll position (router, data-keep-scroll).
        addHtml(nav, 'a', {class: 'wp-tab', href: href(t.route), 'data-keep-scroll': '', 'aria-current': sameTab(s, t.route, current) ? 'page' : undefined}, t.label);
    return nav;
}

/* ---------- Header ---------- */

// Web and email links open in a new tab (webmail opens there); tel: and the like in place.
const iconLink = (url: string, label: string, name: IconName, cls = 'wp-icon-btn') =>
    newHtml('a', {href: url, class: cls, 'aria-label': label, title: label, ...(/^(https?|mailto):/i.test(url) && {target: '_blank', rel: 'noopener'})}, icon(name, 18));

export const followData = (s: Site, feed: SiteFeed): FollowFeed =>
    ({title: feed.name ? feedTitle(feed) : siteName(s), url: feed.url, meta: '@' + s.host, site: s.host, iconUrl: feed.json.icon});

function header(s: Site, feed: SiteFeed | undefined): HTMLElement {
    const top = newHtml('header', {class: 'wp-header'});
    const banner = addHtml(top, 'div', {class: s.props.banner ? 'wp-banner' : 'wp-banner wp-banner-plain'});
    if (s.props.banner)
        addHtml(banner, 'img', {src: s.props.banner, alt: ''});
    const head = addHtml(top, 'div', {class: 'wp-head'});
    // No image of its own: the avatar stays empty (no guessing from icons).
    const avatar = addHtml(head, 'div', {class: s.props.avatar ? 'wp-avatar' : 'wp-avatar wp-avatar-empty'});
    if (s.props.avatar)
        addHtml(avatar, 'img', {src: s.props.avatar, alt: ''});
    const actions = addHtml(head, 'div', {class: 'wp-actions'});
    const email = preferredEmail(s.contact);
    if (email?.href)
        actions.appendChild(iconLink(email.href, `Email ${email.value}`, 'mail', 'wp-icon-btn wp-icon-btn-lg'));
    if (feed)
        actions.appendChild(followButton(followData(s, feed)));

    const id = addHtml(top, 'div', {class: 'wp-id'});
    addHtml(id, 'h1', {class: 'wp-name'}, newHtml('a', {href: href({page: 'feed'})}, siteName(s)));
    const name = s.props.title && s.props.name && s.props.name != s.props.title ? s.props.name : undefined;
    addHtml(id, 'p', {class: 'wp-handle'}, name ? [newHtml('span', {class: 'wp-owner'}, name), ' · @' + s.host] : '@' + s.host);
    const summary = siteSummary(s);
    if (summary)
        addHtml(id, 'p', {class: 'wp-summary'}, summary);
    return top;
}

/* ---------- Markdown ---------- */

/** The site's own Markdown (about.md, pages, footer) as DOM. Links to the site open in place, not
 *  in a new tab like other links, and links to the Markdown file of a page go to that page. */
export function siteMarkdown(s: Site, markdown: string, base: string): DocumentFragment {
    const fragment = renderMarkdown(markdown, base);
    fragment.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(a => {
        let url: URL;
        try {
            url = new URL(a.getAttribute('href')!, base);
        } catch {
            return;
        }
        if (url.origin != s.origin)
            return;
        a.removeAttribute('target');
        a.removeAttribute('rel');
        const page = s.pages.find(p => p.url == url.href.replace(/#.*$/, ''));
        if (page)
            a.href = href({page: 'page', name: page.name}, url.hash);
    });
    return fragment;
}

/* ---------- Info panels ---------- */

function aboutPanel(s: Site): HTMLElement {
    const panel = newHtml('section', {class: 'wp-about wp-md'});
    if (s.about?.markdown)
        panel.appendChild(siteMarkdown(s, s.about.markdown, s.origin + '/'));
    else
        addHtml(panel, 'p', {class: 'wp-empty'}, 'The about page is empty.');
    return panel;
}

function followRow(f: FollowEntry): HTMLElement {
    const li = newHtml('li', {class: 'wp-follow-row'});
    const site = f.siteUrl ?? `https://${f.host}/`;
    li.appendChild(external(site, {class: 'wp-follow-main'}, [
        newHtml('span', {class: 'wp-follow-name'}, f.name),
        newHtml('span', {class: 'wp-follow-handle'}, f.handle),
    ]));
    if (f.feedUrl)
        li.appendChild(iconLink(f.feedUrl, `Feed of ${f.name}`, 'rss'));
    return li;
}

const FOLLOWING_PAGE = 100;

function followingPanel(following: FollowEntry[]): HTMLElement {
    const panel = newHtml('section', {class: 'wp-following'});
    if (!following.length) {
        addHtml(panel, 'p', {class: 'wp-empty'}, 'The list is empty.');
        return panel;
    }
    addHtml(panel, 'p', {class: 'wp-kicker wp-count'}, `Follows ${following.length.toLocaleString()} site${following.length == 1 ? '' : 's'}`);
    const list = addHtml(panel, 'ul', {class: 'wp-follow-list'});
    const more = newHtml('button', {type: 'button', class: 'wp-btn wp-more'});
    let shown = 0;
    const showMore = () => {
        following.slice(shown, shown + FOLLOWING_PAGE).forEach(f => list.appendChild(followRow(f)));
        shown = Math.min(shown + FOLLOWING_PAGE, following.length);
        more.textContent = `Show more (${(following.length - shown).toLocaleString()} left)`;
        more.hidden = shown >= following.length;
    };
    more.onclick = showMore;
    showMore();
    panel.appendChild(more);
    return panel;
}

const KIND_LABELS: Record<ContactEntry['kind'], string> = {email: 'Email', tel: 'Phone', url: 'Website', impp: 'Chat', social: 'Profile'};
const KIND_ICONS: Record<ContactEntry['kind'], IconName> = {email: 'mail', tel: 'phone', url: 'external', impp: 'chat', social: 'link'};

function contactRow(label: string, value: string, action?: HTMLElement): HTMLElement {
    const row = newHtml('div', {class: 'wp-contact-row'});
    addHtml(row, 'div', {class: 'wp-contact-text'}, [newHtml('div', {class: 'wp-kicker'}, label), newHtml('div', {class: 'wp-contact-value'}, value)]);
    if (action)
        row.appendChild(action);
    return row;
}

function contactPanel(c: Contact): HTMLElement {
    const panel = newHtml('section', {class: 'wp-contact'});
    if (c.name)
        panel.appendChild(contactRow('Name', c.name));
    if (c.org || c.title)
        panel.appendChild(contactRow(c.org ? 'Organization' : 'Title', [c.title, c.org].filter(Boolean).join(', ')));
    for (const e of c.entries) {
        const kind = e.kind == 'social' && e.label ? e.label : KIND_LABELS[e.kind];
        const label = [kind, e.kind != 'social' ? e.label : undefined, e.pref ? 'preferred' : undefined].filter(Boolean).join(' · ');
        panel.appendChild(contactRow(label, e.value, e.href ? iconLink(e.href, `${kind}: ${e.value}`, KIND_ICONS[e.kind]) : undefined));
    }
    if (!panel.children.length)
        addHtml(panel, 'p', {class: 'wp-empty'}, 'The contact card is empty.');
    return panel;
}

function pagePanel(s: Site, page: MarkdownFile, all: boolean): HTMLElement {
    const panel = newHtml('section', {class: 'wp-page wp-md'});
    if (all)
        addHtml(panel, 'p', {class: 'wp-page-back'}, newHtml('a', {href: href({page: 'pages'})}, '← All pages'));
    panel.appendChild(page.markdown.trim() ? siteMarkdown(s, page.markdown, page.url) : newHtml('p', {class: 'wp-empty'}, 'This page is empty.'));
    return panel;
}

function pagesPanel(s: Site): HTMLElement {
    const panel = newHtml('section', {class: 'wp-pages'});
    const list = addHtml(panel, 'ul', {class: 'wp-page-list'});
    for (const p of listedPages(s))
        addHtml(list, 'li', {}, newHtml('a', {href: href({page: 'page', name: p.name})}, p.title));
    return panel;
}

function notFound(): HTMLElement {
    return newHtml('section', {class: 'wp-notfound'}, [
        newHtml('h2', {}, 'Page not found'),
        newHtml('p', {}, ['This page doesn’t exist (any more). ', newHtml('a', {href: href({page: 'feed'})}, 'Go to the start page'), '.']),
    ]);
}

function nothing(s: Site): HTMLElement {
    return newHtml('section', {class: 'wp-notfound'}, [
        newHtml('h2', {}, 'Nothing published yet'),
        newHtml('p', {}, `${s.host} has no feed and no profile yet. webpup shows the feed /feed.json, the feeds listed in /.well-known/host-meta.json and the SocialSpec files /.well-known/about.md, following.opml and contact.vcf.`),
    ]);
}

/* ---------- Page ---------- */

export interface PageResult {
    title: string;
    /** The feed the Follow button follows. */
    feed?: SiteFeed;
}

/** Renders a page into `app`. `ready` is called when the panel is complete, also its asynchronous
 *  parts (archives). `themeSelector` goes between the panel and the footer (the same element on
 *  every page, so it keeps its scroll position). */
export function renderPage(app: HTMLElement, s: Site, requested: Route, ctx: PostContext, ready: (panel: HTMLElement) => void,
    themeSelector?: HTMLElement): PageResult {
    const route = resolveRoute(s, requested) ?? {page: 'notfound'};
    const feed = route.page == 'feed' ? feedOfRoute(s, route.feed) : undefined;
    const followed = feed ?? s.feeds[0];
    const name = siteName(s);
    let panel: HTMLElement;
    let title = name;
    const done = () => setTimeout(() => ready(panel));
    if (route.page == 'feed' && feed && route.archive != undefined && feed.archives) {
        panel = archivePanel(feed, route.archive, ctx, ready);
        title = `${feed.name ? feedTitle(feed) : 'Posts'}, page ${route.archive} · ${name}`;
    } else if (route.page == 'feed' && feed && route.archive == undefined) {
        panel = latestPanel(feed, ctx, ready);
        if (feed.name)
            title = `${feedTitle(feed)} · ${name}`;
    } else if (route.page == 'page' && s.pages.some(p => p.name == route.name)) {
        const page = s.pages.find(p => p.name == route.name)!;
        panel = pagePanel(s, page, !page.hidden && listedPages(s).length > 1);
        title = `${page.title} · ${name}`;
        done();
    } else if (route.page == 'pages' && listedPages(s).length) {
        panel = pagesPanel(s);
        title = `Pages · ${name}`;
        done();
    } else if (route.page != 'feed' && route.page != 'notfound' && route.page != 'page' && route.page != 'pages' && hasInfo(s, route.page)) {
        panel = route.page == 'about' ? aboutPanel(s) : route.page == 'following' ? followingPanel(s.following!) : contactPanel(s.contact!);
        title = `${INFO_TABS.find(t => t.page == route.page)!.label} · ${name}`;
        done();
    } else {
        panel = tabsOf(s).length ? notFound() : nothing(s);
        title = tabsOf(s).length ? `Page not found · ${name}` : name;
        done();
    }
    const main = newHtml('main', {id: 'wp-main', class: 'wp-main', tabindex: '-1'}, panel);
    app.replaceChildren(...[header(s, followed), tabBar(s, route), main, themeSelector, footer(s)].filter((e): e is HTMLElement => !!e));
    return {title, feed: followed};
}

function footer(s: Site): HTMLElement {
    const foot = newHtml('footer', {class: 'wp-footer'});
    if (s.footer?.markdown.trim())
        addHtml(foot, 'div', {class: 'wp-footer-text wp-md'}, siteMarkdown(s, s.footer.markdown, s.footer.url));
    if (s.feeds.length)
        addHtml(foot, 'p', {}, ['Feeds: ', ...s.feeds.flatMap((f, i) => [i ? ', ' : '', external(f.url, {type: 'application/feed+json'}, f.name ? feedTitle(f) : 'Posts')])]);
    return foot;
}
