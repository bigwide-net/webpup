// Keyboard navigation in the feeds, like in feed readers: j or n goes to the next post, k or p to the
// previous one. The post is scrolled to the top and marked (wp-current).

const STEP: Record<string, number> = {j: 1, n: 1, k: -1, p: -1};
/** The posts' scroll-margin-top (webpup.css). */
const TOP = 16;

/** Whether the key press belongs to something else: a field, a shortcut, an open dialog. */
function ignored(e: KeyboardEvent): boolean {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.isComposing)
        return true;
    const target = e.target instanceof Element ? e.target : null;
    return !!target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])') || !!document.querySelector('dialog[open]');
}

const visible = (e: Element) => {
    const r = e.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight;
};

/** The post to go to from the current one (the marked one while it's visible, else by the scroll
 *  position), or undefined at either end. */
export function stepTarget(cards: HTMLElement[], step: number): HTMLElement | undefined {
    const current = cards.findIndex(c => c.classList.contains('wp-current'));
    if (current >= 0 && visible(cards[current]))
        return cards[current + step];
    const tops = cards.map(c => c.getBoundingClientRect().top - TOP);
    if (step > 0)
        return cards.find((_, i) => tops[i] > 1);
    for (let i = cards.length - 1; i >= 0; i--)
        if (tops[i] < -1)
            return cards[i];
    return undefined;
}

export function installKeys(): void {
    addEventListener('keydown', e => {
        const step = STEP[e.key];
        if (!step || ignored(e))
            return;
        const cards = [...document.querySelectorAll<HTMLElement>('.wp-posts .postCard')];
        if (!cards.length)
            return;
        e.preventDefault();
        const card = stepTarget(cards, step);
        if (!card)
            // Past the last post: the pager (Older posts); before the first: the top of the page.
            return scrollTo(0, step > 0 ? document.documentElement.scrollHeight : 0);
        cards.forEach(c => c.classList.toggle('wp-current', c == card));
        card.tabIndex = -1;
        card.focus({preventScroll: true});
        card.scrollIntoView({block: 'start'});
    });
}
