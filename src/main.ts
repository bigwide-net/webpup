// webpup: a single-page website for a domain with a Personal Upload Server (RFC-6). index.html loads
// this script, which reads the site's files (data.ts) and renders the page for the URL (router.ts,
// view.ts). See README.md.
import { initFollow } from '@lib/follow/src/follow';
import { preferredEmail } from '@lib/socialspec/src/vcard';
import { loadSite, type Site } from './data';
import { followDialog } from './follow';
import { installKeys } from './keys';
import { createConsent, hydrateEmbeds, type PostContext } from './posts';
import { detectUrlStyle, startRouter, type Route } from './router';
import { applyThemeColor, hasTheme, themeSelector } from './themes';
import { renderPage, siteSummary } from './view';

function setMeta(name: string, content: string | undefined): void {
    let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
    if (!content)
        return meta?.remove();
    meta ??= document.head.appendChild(Object.assign(document.createElement('meta'), {name}));
    meta.content = content;
}

/** What the site's properties change outside the page body. */
function applySite(s: Site): void {
    if (s.props.language)
        document.documentElement.lang = s.props.language;
    // A theme color only applies without a theme.
    applyThemeColor(s, !hasTheme());
    setMeta('description', siteSummary(s));
    const favicon = s.feeds.find(f => !f.name)?.json.favicon;
    if (favicon && /^https?:\/\//.test(favicon))
        document.head.appendChild(Object.assign(document.createElement('link'), {rel: 'icon', href: favicon}));
    // Feed autodiscovery for the named feeds (index.html links /feed.json itself).
    for (const f of s.feeds.filter(f => f.name))
        document.head.appendChild(Object.assign(document.createElement('link'), {rel: 'alternate', type: 'application/feed+json', href: f.url, title: f.json.title ?? f.name}));
}

/** Scrolls to the post of the #fragment and marks it. */
function showTarget(hash: string): boolean {
    let id = hash.slice(1);
    try {
        id = decodeURIComponent(id);
    } catch { /* as is */ }
    const target = id ? document.getElementById(id) : null;
    document.querySelectorAll('.wp-target').forEach(e => e.classList.remove('wp-target'));
    if (!target)
        return false;
    target.classList.add('wp-target');
    target.scrollIntoView({block: 'start'});
    return true;
}

async function start(): Promise<void> {
    const app = document.getElementById('wp-app')!;
    const [site, style] = await Promise.all([loadSite(), detectUrlStyle(location.pathname)]);
    applySite(site);
    const selector = site.config.themeSelector ? await themeSelector(site) : undefined;
    initFollow();
    document.body.appendChild(followDialog());
    installKeys();

    const email = preferredEmail(site.contact);
    const ctx: PostContext = {site, consent: createConsent(site.config.embeds), email: email?.href ? email : undefined};
    let shown = '';
    startRouter(style, (route: Route, hash: string, how, keepScroll) => {
        // Only the #fragment changed: same page, another post.
        const key = location.pathname + location.search;
        if (key == shown && how == 'pop') {
            showTarget(hash);
            return;
        }
        shown = key;
        // Back/Forward: where the page was; a tab: where it is now; any other link: the top.
        const scroll = how == 'pop' ? history.state?.scroll : keepScroll ? scrollY : 0;
        const {title} = renderPage(app, site, route, ctx, panel => {
            hydrateEmbeds(panel, ctx.consent);
            if (!showTarget(hash) && how == 'pop' && typeof scroll == 'number')
                scrollTo(0, scroll);
        }, selector);
        document.title = title;
        document.body.dataset.state = 'ready';
        if (!hash)
            scrollTo(0, typeof scroll == 'number' ? scroll : 0);
        if (how == 'push')
            document.getElementById('wp-main')?.focus({preventScroll: true});
    });
}

start().catch(e => {
    console.error('webpup:', e);
    document.body.dataset.state = 'error';
    const app = document.getElementById('wp-app');
    if (app)
        app.textContent = 'This page could not be loaded.';
});
