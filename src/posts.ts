// A feed's page: its newest posts (the feed file) or one of its archives (RFC-7), each post a card
// of postviewer, with Older/Newer links between the archive pages.
import type { EmbedConsentApi } from '@lib/postviewer/src/embed-consent';
import { addHtml, newHtml } from '@lib/postviewer/src/dom';
import { loadExternalScripts } from '@lib/postviewer/src/external-scripts';
import { createPostParts } from '@lib/postviewer/src/post-card';
import type { EmbedService } from '@lib/postviewer/src/types';
import { icon } from '@lib/socialspec/src/icons';
import type { ContactEntry } from '@lib/socialspec/src/vcard';
import { loadArchive, type Config, type Site, type SiteFeed } from './data';
import { attachmentDetails, embedScripts, fileName, itemAttachments, itemId, itemTags, toPost, type JsonFeed, type JsonFeedItem } from './jsonfeed';
import { href, type Route } from './router';

/** How many archives "Older posts" looks through for the first post the feed file doesn't have. */
const MAX_ARCHIVE_LOOKUPS = 4;

export const feedTitle = (feed: SiteFeed) => feed.json.title?.trim() || (feed.name ?? 'Posts');

export const feedRoute = (feed: SiteFeed, archive?: number): Route => ({page: 'feed', feed: feed.name, archive});

/* ---------- Embeds ---------- */

const CONSENT_KEY = 'webpup.embeds';

/** Where the visitor's consent to embeds lives, by the site's webpup-config.json: 'on' allows all,
 *  'consent' asks per service and remembers the answer in localStorage, 'off' allows nothing. */
export function createConsent(embeds: Config['embeds']): EmbedConsentApi {
    if (embeds == 'on')
        return {isAllowed: () => true, grant: () => {}};
    if (embeds == 'off')
        return {isAllowed: () => false, grant: () => {}};
    const read = (): EmbedService[] => {
        try {
            const v = JSON.parse(localStorage.getItem(CONSENT_KEY) ?? '[]');
            return Array.isArray(v) ? v : [];
        } catch {
            return [];
        }
    };
    const session = new Set<EmbedService>(read());
    return {
        isAllowed: s => session.has(s),
        grant: s => {
            session.add(s);
            try {
                localStorage.setItem(CONSENT_KEY, JSON.stringify([...session]));
            } catch { /* allowed for this page view only */ }
        },
    };
}

/** embeds: 'off': the gated embeds lose their players (iframes) and overlays; embedded posts stay
 *  as the plain quotes they are without their vendor's script. */
function stripEmbeds(root: ParentNode): void {
    root.querySelectorAll('.embedGate').forEach(gate => {
        gate.querySelectorAll('.embedGateOverlay, iframe').forEach(e => e.remove());
        gate.replaceWith(...Array.from(gate.childNodes));
    });
}

/** Loads the vendor scripts of the allowed embeds in `root` (which must be in the document). */
export function hydrateEmbeds(root: HTMLElement, consent: EmbedConsentApi): void {
    loadExternalScripts(embedScripts(root.innerHTML), root, consent.isAllowed);
}

/* ---------- Posts ---------- */

export interface PostContext {
    site: Site;
    consent: EmbedConsentApi;
    /** For "Reply by email" (the contact card's preferred address). */
    email?: ContactEntry;
}

function replyHref(email: ContactEntry, title: string | undefined, url: string): string {
    const subject = `Re: ${title ?? 'your post'}`;
    return `${email.href!.split('?')[0]}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`\n\n> ${url}\n`)}`;
}

const downloadLink = (url: string, text: string) => newHtml('a', {href: url, download: '', target: '_blank', rel: 'noopener'}, text);

/** Under the player: the enclosure's duration, format and size, and a download link. Then the
 *  other attachments (not the played file nor the lead image) as download links. */
function addAttachments(parts: HTMLElement[], item: JsonFeedItem, imageUrl: string | undefined): void {
    const all = itemAttachments(item);
    const player = parts.findIndex(p => p.classList.contains('postMedia'));
    const played = player >= 0 ? all.find(a => a.url == parts[player].querySelector('audio, video')?.getAttribute('src')) : undefined;
    if (played)
        parts.splice(player + 1, 0, newHtml('p', {class: 'wp-media-info'},
            [...attachmentDetails(played).flatMap(d => [newHtml('span', {}, d), ' · ']), downloadLink(played.url!, 'Download')]));
    const others = all.filter(a => a != played && a.url != imageUrl);
    if (!others.length)
        return;
    const list = newHtml('ul', {class: 'wp-attachments', 'aria-label': 'Attachments'});
    for (const a of others) {
        const details = attachmentDetails(a);
        addHtml(list, 'li', {}, [downloadLink(a.url!, a.title?.trim() || fileName(a.url!)),
            ...details.length ? [newHtml('span', {class: 'wp-attachment-details'}, details.join(' · '))] : []]);
    }
    // After the body, before tags and actions.
    const body = parts.findIndex(p => p.classList.contains('postBody'));
    parts.splice(body >= 0 ? body + 1 : parts.length, 0, list);
}

function postCard(item: JsonFeedItem, index: number, feed: SiteFeed, page: Route, ctx: PostContext): HTMLElement {
    const post = toPost(item, ctx.site.origin + '/');
    const id = itemId(item);
    const parts = createPostParts(post, {feedName: feedTitle(feed), feedHref: href(feedRoute(feed)), consent: ctx.consent});
    addAttachments(parts, item, post.imageUrl);
    const tags = itemTags(item);
    if (tags.length)
        parts.push(newHtml('ul', {class: 'wp-tags', 'aria-label': 'Tags'}, tags.map(t => newHtml('li', {}, t))));

    const actions = newHtml('div', {class: 'wp-post-actions'});
    const permalink = id ? href(page, '#' + encodeURIComponent(id)) : undefined;
    if (permalink)
        addHtml(actions, 'a', {class: 'wp-post-action', href: permalink, title: 'Link to this post'}, [icon('link', 15), 'Link']);
    if (post.link)
        addHtml(actions, 'a', {class: 'wp-post-action', href: post.link, target: '_blank', rel: 'noopener'}, [icon('external', 15), 'Open']);
    if (ctx.email?.href)
        addHtml(actions, 'a', {class: 'wp-post-action wp-post-reply', href: replyHref(ctx.email, post.title, new URL(permalink ?? href(page), location.href).href),
            title: `Reply by email to ${ctx.email.value}`}, [icon('reply', 15), 'Reply']);
    if (actions.childElementCount)
        parts.push(actions);

    const card = newHtml('article', {class: 'postCard', id}, parts);
    if (ctx.site.config.embeds == 'off')
        stripEmbeds(card);
    return newHtml('li', {class: 'postItem'}, card);
}

function postList(items: JsonFeedItem[], feed: SiteFeed, page: Route, ctx: PostContext): HTMLElement {
    const list = newHtml('ol', {class: 'wp-posts'});
    items.forEach((item, i) => list.appendChild(postCard(item, i, feed, page, ctx)));
    return list;
}

const empty = (text: string) => newHtml('p', {class: 'wp-empty'}, text);

const dateOf = (item: JsonFeedItem) => {
    const d = new Date(item.date_published ?? item.date_modified ?? '');
    return isNaN(d.getTime()) ? undefined : d;
};
const formatDate = (d: Date) => d.toLocaleDateString(document.documentElement.lang || undefined, {month: 'short', day: 'numeric', year: 'numeric'});

/** "Mar 2 – Apr 10, 2026": the dates of an archive's posts. */
function dateRange(items: JsonFeedItem[]): string | undefined {
    const dates = items.map(dateOf).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime());
    if (!dates.length)
        return undefined;
    const [first, last] = [formatDate(dates[0]), formatDate(dates[dates.length - 1])];
    return first == last ? first : `${first} – ${last}`;
}

function pager(links: (HTMLElement | undefined)[]): HTMLElement {
    return newHtml('nav', {class: 'wp-pager', 'aria-label': 'Pages'}, links.filter((l): l is HTMLElement => !!l));
}

const pageLink = (route: Route, text: string, cls: string) => newHtml('a', {class: `wp-pager-link ${cls}`, href: href(route)}, text);

/** The newest archive with a post that the feed file doesn't have: where "Older posts" goes. */
async function olderArchive(feed: SiteFeed): Promise<number | undefined> {
    const shown = new Set(feed.json.items.map(itemId));
    const {newest} = feed.archives!;
    for (let n = newest; n >= 0 && n > newest - MAX_ARCHIVE_LOOKUPS; n--) {
        const archive = await loadArchive(feed, n);
        if (archive?.items.some(i => !shown.has(itemId(i))))
            return n;
    }
    return newest - MAX_ARCHIVE_LOOKUPS >= 0 ? newest - MAX_ARCHIVE_LOOKUPS : undefined;
}

/** A feed's description, above its posts. The main feed's is the site's summary unless the site
 *  has its own, so only named feeds show it. */
function feedHead(feed: SiteFeed): HTMLElement | undefined {
    if (!feed.name)
        return undefined;
    const head = newHtml('header', {class: 'wp-feed-head'});
    addHtml(head, 'h2', {class: 'wp-feed-title'}, feedTitle(feed));
    if (feed.json.description?.trim())
        addHtml(head, 'p', {class: 'wp-feed-desc'}, feed.json.description.trim());
    return head;
}

/** The newest posts of a feed: everything in the feed file. Calls `ready` once the panel is complete
 *  (the "Older posts" link is found after the archives were looked at). */
export function latestPanel(feed: SiteFeed, ctx: PostContext, ready: (panel: HTMLElement) => void): HTMLElement {
    const page = feedRoute(feed);
    const panel = newHtml('section', {class: 'wp-feed'});
    const head = feedHead(feed);
    if (head)
        panel.appendChild(head);
    panel.appendChild(feed.json.items.length ? postList(feed.json.items, feed, page, ctx) : empty('No posts yet.'));
    if (feed.archives)
        olderArchive(feed).then(n => {
            if (n != undefined)
                panel.appendChild(pager([undefined, pageLink(feedRoute(feed, n), 'Older posts →', 'wp-older')]));
            ready(panel);
        });
    else
        setTimeout(() => ready(panel));
    return panel;
}

/** Archive `n` of a feed. Calls `ready` once it is loaded and shown. */
export function archivePanel(feed: SiteFeed, n: number, ctx: PostContext, ready: (panel: HTMLElement) => void): HTMLElement {
    const page = feedRoute(feed, n);
    const panel = newHtml('section', {class: 'wp-feed wp-archive', 'aria-busy': 'true'});
    const head = feedHead(feed);
    if (head)
        panel.appendChild(head);
    const archiveHead = addHtml(panel, 'header', {class: 'wp-archive-head'}, [newHtml('div', {class: 'wp-kicker'}, 'Archive'), newHtml('h2', {}, `Page ${n}`)]);
    const loading = addHtml(panel, 'p', {class: 'wp-empty'}, 'Loading…');
    const show = (archive: JsonFeed | undefined) => {
        loading.remove();
        panel.removeAttribute('aria-busy');
        const {newest} = feed.archives!;
        if (!archive)
            panel.appendChild(empty(n > newest ? 'This archive page doesn’t exist.' : 'This archive page can’t be loaded.'));
        else {
            const range = dateRange(archive.items);
            if (range)
                addHtml(archiveHead, 'p', {class: 'wp-archive-dates'}, range);
            panel.appendChild(archive.items.length ? postList(archive.items, feed, page, ctx) : empty('This archive page has no posts.'));
        }
        // Archives are numbered from 0, the oldest (RFC-7); each number exists up to the newest.
        const older = n > 0 && n <= newest ? n - 1 : undefined;
        panel.appendChild(pager([
            n < newest ? pageLink(feedRoute(feed, n + 1), '← Newer posts', 'wp-newer') : pageLink(feedRoute(feed), '← Latest posts', 'wp-newer'),
            older != undefined ? pageLink(feedRoute(feed, older), 'Older posts →', 'wp-older') : undefined,
        ]));
        ready(panel);
    };
    if (feed.archives && n <= feed.archives.newest)
        loadArchive(feed, n).then(show);
    else
        setTimeout(() => show(undefined));
    return panel;
}
