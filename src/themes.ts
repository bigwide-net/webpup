// The theme color of host-meta.json, and the theme selector: a row of theme thumbnails at the bottom
// of the page (webpup-config.json "theme-selector"). A click puts the theme on the page until it is
// reloaded; the text under the row says which file to copy to keep it. The themes are in
// /webpup-themes/: index.json (the list), <id>.css and <id>.jpg (the thumbnail).
import { addHtml, newHtml } from '@lib/postviewer/src/dom';
import type { Site } from './data';

export const THEMES_DIR = '/webpup-themes/';

export interface ThemeInfo {
    id: string;
    title: string;
}

const themeLink = () => document.querySelector<HTMLLinkElement>('link[rel="stylesheet"][href="/theme.css"]');

/** Whether /theme.css has any rules: a theme replaces webpup's look, and the theme color. */
export function hasTheme(): boolean {
    const link = themeLink();
    try {
        return !!link?.sheet?.cssRules.length;
    } catch {
        return !!link;
    }
}

/** Black or white text, whichever reads better on `color`. */
function textOn(color: string): string {
    const probe = document.createElement('span');
    probe.style.color = color;
    document.body.appendChild(probe);
    const [r, g, b] = (getComputedStyle(probe).color.match(/\d+(\.\d+)?/g) ?? ['0', '0', '0']).map(Number);
    probe.remove();
    const lin = (c: number) => (c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) > 0.4 ? '#000' : '#fff';
}

/** Puts the site's theme color (https://bigwide.net/ns/theme-color) on the page, or takes it off. */
export function applyThemeColor(s: Site, on: boolean): void {
    const color = s.props.themeColor;
    const root = document.documentElement.style;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!on || !color || !CSS.supports('color', color)) {
        root.removeProperty('--wp-accent');
        root.removeProperty('--wp-on-accent');
        meta?.remove();
        return;
    }
    root.setProperty('--wp-accent', color);
    root.setProperty('--wp-on-accent', textOn(color));
    meta ??= document.head.appendChild(Object.assign(document.createElement('meta'), {name: 'theme-color'}));
    meta.content = color;
}

async function loadThemes(): Promise<ThemeInfo[]> {
    try {
        const res = await fetch(THEMES_DIR + 'index.json', {cache: 'no-cache', credentials: 'omit'});
        const json = res.ok ? await res.json() : undefined;
        return (Array.isArray(json?.themes) ? json.themes : [])
            .filter((t: any) => typeof t?.id == 'string' && /^[a-z0-9-]+$/.test(t.id) && typeof t.title == 'string');
    } catch {
        return [];
    }
}

/** The theme selector, or undefined if /webpup-themes/ has no themes. */
export async function themeSelector(s: Site): Promise<HTMLElement | undefined> {
    const themes = await loadThemes();
    if (!themes.length) {
        console.warn(`webpup: theme-selector is on, but ${THEMES_DIR}index.json has no themes`);
        return undefined;
    }
    const original = themeLink();
    const own = hasTheme();
    const box = newHtml('section', {class: 'wp-themes', 'aria-labelledby': 'wp-themes-title'});
    addHtml(box, 'h2', {id: 'wp-themes-title', class: 'wp-kicker'}, 'Try a theme');
    const row = addHtml(box, 'div', {class: 'wp-theme-row', role: 'group', 'aria-label': 'Themes'});
    const keep = addHtml(box, 'p', {class: 'wp-theme-help'});
    addHtml(box, 'p', {class: 'wp-theme-help'}, ['To remove this theme selector, add a file ', newHtml('code', {}, 'webpup-config.json'),
        ' next to ', newHtml('code', {}, 'index.html'), ', e.g. with ', newHtml('code', {}, '{ "theme-selector": false }'), '.']);

    // The site's own theme.css (if it has one), webpup's default look, then the themes.
    const choices = [
        ...own ? [{id: 'current', title: 'Current theme'}] : [],
        {id: 'default', title: 'Default'},
        ...themes,
    ];
    let preview: HTMLLinkElement | undefined;
    const choose = (id: string, button: HTMLElement) => {
        row.querySelectorAll('[aria-pressed]').forEach(b => b.setAttribute('aria-pressed', String(b == button)));
        if (original)
            original.disabled = id != 'current';
        if (id == 'current' || id == 'default') {
            preview?.remove();
            preview = undefined;
        } else {
            preview ??= (original ?? document.head.lastElementChild!).insertAdjacentElement('afterend',
                Object.assign(document.createElement('link'), {rel: 'stylesheet', id: 'wp-theme-preview'})) as HTMLLinkElement;
            preview.href = `${THEMES_DIR}${id}.css`;
        }
        applyThemeColor(s, id == 'default' || id == 'current' && !own);
        const theme = choices.find(c => c.id == id)!;
        keep.replaceChildren(...id == 'current' ? ['This is the site’s theme (', newHtml('code', {}, 'theme.css'), '). Click a theme to try it on this page, until you reload it.']
            : id == 'default' ? ['To keep webpup’s default look, make ', newHtml('code', {}, 'theme.css'), ' next to ', newHtml('code', {}, 'index.html'), ' an empty file.']
            : [`To keep “${theme.title}”, copy `, newHtml('code', {}, `${THEMES_DIR.slice(1)}${id}.css`), ' to ', newHtml('code', {}, 'theme.css'),
                ' next to ', newHtml('code', {}, 'index.html'), ', replacing it.']);
    };
    for (const c of choices) {
        const button = addHtml(row, 'button', {type: 'button', class: 'wp-theme', 'aria-pressed': 'false', title: c.title}, [
            newHtml('img', {src: `${THEMES_DIR}${c.id == 'current' ? 'default' : c.id}.jpg`, alt: '', loading: 'lazy', width: 200, height: 140}),
            newHtml('span', {}, c.title),
        ]);
        button.onclick = () => choose(c.id, button);
    }
    const start = row.firstElementChild as HTMLElement;
    start.setAttribute('aria-pressed', 'true');
    keep.replaceChildren('Click a theme to try it on this page, until you reload it.');
    return box;
}
