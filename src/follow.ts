// The Follow button: a reader-independent follow dialog, the one of rssdirectory.org and sodir.org
// (lib/follow). Its markup is the template lib/follow/templates/follow-dialog.njk, built here; the
// readers keep their order (data-order="fixed"), Downread first.
import type { FollowFeed } from '@lib/follow/src/follow';
import { addHtml, newHtml, newSvg } from '@lib/postviewer/src/dom';
import { icon } from '@lib/socialspec/src/icons';

/** Subscribe URLs: {url} = the feed URL encoded, {rawUrl} = as is, {site} = the domain. The feeds
 *  are JSON Feeds (RFC-7), so only readers that read JSON Feed belong here. */
export const READERS: {name: string, url: string}[] = [
    {name: 'Downread', url: 'https://feeds.downread.com/add?url={url}'},
    {name: 'Feedbin', url: 'https://feedbin.com/?subscribe={url}'},
    {name: 'Feedly', url: 'https://feedly.com/i/subscription/feed/{url}'},
    {name: 'Inoreader', url: 'https://www.inoreader.com/?add_feed={url}'},
    {name: 'NetNewsWire', url: 'feed:{rawUrl}'},
    {name: 'NewsBlur', url: 'https://www.newsblur.com/?url={url}'},
    {name: 'HyperTexting', url: 'htxt://{site}'},
];

const check = () => newSvg('svg', {width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 3.2,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true'}, newSvg('path', {d: 'M5 12.5l4.5 4.5L19 7.5'}));
const cross = () => newSvg('svg', {width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.6,
    'stroke-linecap': 'round', 'aria-hidden': 'true'}, [newSvg('path', {d: 'M6 6l12 12'}), newSvg('path', {d: 'M18 6L6 18'})]);

const step = (n: string, title: string) => newHtml('div', {class: 'fd-step-title'}, [newHtml('b', {}, n), newHtml('h3', {}, title)]);

/** The dialog, as followDialog(readers, nameFeed = false) renders it. */
export function followDialog(): HTMLDialogElement {
    const d = newHtml('dialog', {id: 'follow-dialog', class: 'fd', 'aria-labelledby': 'fd-title', 'data-order': 'fixed'}) as HTMLDialogElement;
    const head = addHtml(d, 'div', {class: 'fd-head'});
    addHtml(head, 'img', {id: 'fd-icon', class: 'feed-icon', width: 64, height: 64, alt: ''});
    addHtml(head, 'div', {class: 'fd-head-text'}, [
        newHtml('div', {class: 'kicker'}, 'Follow'),
        newHtml('h2', {id: 'fd-title', class: 'display'}),
        newHtml('div', {id: 'fd-meta', class: 'fd-meta'}),
    ]);
    addHtml(head, 'button', {type: 'button', class: 'fd-close', 'data-fd-close': '', 'aria-label': 'Close'}, cross());

    const s1 = addHtml(d, 'div', {class: 'fd-step'}, step('1', 'Which reader do you use?'));
    const readers = addHtml(s1, 'div', {class: 'fd-readers', role: 'radiogroup', 'aria-label': 'Reader'});
    for (const r of READERS)
        addHtml(readers, 'button', {type: 'button', role: 'radio', 'aria-checked': 'false', class: 'fd-reader', 'data-reader': r.name, 'data-reader-url': r.url}, [check(), r.name]);
    addHtml(readers, 'button', {type: 'button', role: 'radio', 'aria-checked': 'false', class: 'fd-reader fd-reader-custom', 'data-reader': 'Custom', 'data-label': 'your reader', 'data-custom': ''},
        [check(), newHtml('span', {class: 'fd-wrench'}, icon('pencil', 18, 2)), 'Custom']);
    const custom = addHtml(s1, 'div', {class: 'fd-custom', hidden: ''});
    addHtml(custom, 'label', {for: 'fd-custom-url'}, 'Your reader’s subscribe URL');
    addHtml(custom, 'input', {id: 'fd-custom-url', class: 'input', type: 'text', inputmode: 'url', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-describedby': 'fd-custom-hint fd-custom-error'});
    addHtml(custom, 'p', {id: 'fd-custom-hint', class: 'fd-custom-hint'}, [newHtml('code', {}, '{URL}'),
        ' is replaced by the feed’s URL: encoded when it is a parameter (after “?”), as it is in a path. Other schemes than https, like ',
        newHtml('code', {}, 'feed:{URL}'), ', work too.']);
    addHtml(custom, 'p', {id: 'fd-custom-error', class: 'fd-custom-error', hidden: ''});
    addHtml(s1, 'label', {class: 'fd-remember'}, [newHtml('input', {type: 'checkbox', id: 'fd-remember'}),
        newHtml('span', {}, ['Remember ', newHtml('span', {class: 'fd-reader-name'}), '. Next time, Follow goes straight there.'])]);
    addHtml(s1, 'button', {type: 'button', class: 'fd-none', 'data-reader': ''}, 'I don’t have a reader yet');

    const s2 = addHtml(d, 'div', {class: 'fd-step fd-step-2'}, step('2', 'Follow it'));
    const open = addHtml(s2, 'div', {class: 'fd-open-box'});
    addHtml(open, 'a', {id: 'fd-open', class: 'fd-open', href: '#', target: '_blank', rel: 'nofollow noopener'},
        [newHtml('span', {}, ['Open in ', newHtml('span', {class: 'fd-reader-name'})]), icon('external', 22, 2.4)]);
    addHtml(open, 'p', {class: 'fd-hint'}, ['Opens ', newHtml('span', {class: 'fd-reader-name'}), ' in a new tab, ready to confirm.']);
    addHtml(s2, 'div', {class: 'fd-new', hidden: ''}, [newHtml('div', {class: 'fd-new-title'}, 'New to feeds?'),
        newHtml('p', {}, 'A feed reader shows you the new posts of all the sites you follow, in one place and in the order they were published. You decide what you read, not an algorithm. Choose one of the readers above, then come back here and follow.')]);
    addHtml(s2, 'div', {class: 'fd-manual'}, [newHtml('div', {class: 'kicker'}, 'Or copy the address into any reader'),
        newHtml('div', {class: 'fd-url-box'}, [newHtml('input', {id: 'fd-url', type: 'text', readonly: '', spellcheck: 'false', 'aria-label': 'Feed URL'}),
            newHtml('button', {type: 'button', id: 'fd-copy'}, 'Copy')])]);
    addHtml(d, 'div', {class: 'fd-foot'}, newHtml('button', {type: 'button', class: 'fd-back', 'data-fd-close': ''}, ['← ', newHtml('span', {id: 'fd-back'})]));

    // "New to feeds?" only after "I don't have a reader yet": while no reader is picked, lib/follow
    // shows it at once, so the link seemed to do nothing (.wp-fd-help, webpup.css).
    const help = (on: boolean) => {
        d.classList.toggle('wp-fd-help', on);
        d.querySelector('.fd-none')!.setAttribute('aria-pressed', String(on));
    };
    d.addEventListener('click', e => {
        const target = e.target as Element;
        if (target.closest('.fd-none')) {
            help(true);
            d.querySelector('.fd-new')!.scrollIntoView({block: 'nearest', behavior: 'smooth'});
        } else if (target.closest('.fd-reader'))
            help(false);
    });
    d.addEventListener('close', () => help(false));
    // Back and Forward go to another page: the dialog doesn't stay open over it.
    addEventListener('popstate', () => d.open && d.close());
    return d;
}

/** Follow split button, like sodir.org's: "Follow" opens the dialog (or goes straight to the
 *  remembered reader); the chevron menu has the feed URL and "Choose a reader…". */
export function followButton(feed: FollowFeed): HTMLElement {
    const split = newHtml('div', {class: 'wp-follow', 'data-follow': JSON.stringify(feed)});
    addHtml(split, 'button', {type: 'button', class: 'wp-btn wp-btn-accent follow-label', 'aria-label': `Follow ${feed.title}`}, 'Follow');
    const more = addHtml(split, 'details', {class: 'follow-more wp-follow-more'});
    addHtml(more, 'summary', {class: 'wp-follow-chevron', 'aria-label': 'More follow options'}, icon('chevron', 18, 2.6));
    const menu = addHtml(more, 'div', {class: 'wp-follow-menu'});
    addHtml(menu, 'a', {href: feed.url, target: '_blank', rel: 'noopener'}, ['Feed URL', icon('external', 16)]);
    addHtml(menu, 'button', {type: 'button', class: 'follow-choose'}, 'Choose a reader…');
    return split;
}
