import { installKeys, stepTarget } from '../src/keys';

/** Cards whose tops are at the given viewport positions (jsdom has no layout). */
function cards(...tops: number[]): HTMLElement[] {
    document.body.innerHTML = `<ol class="wp-posts">${tops.map((_, i) => `<li><article class="postCard" id="p${i}"></article></li>`).join('')}</ol>`;
    const list = [...document.querySelectorAll<HTMLElement>('.postCard')];
    list.forEach((c, i) => c.getBoundingClientRect = () => ({top: tops[i], bottom: tops[i] + 300} as DOMRect));
    return list;
}

describe('keyboard navigation', () => {
    beforeAll(() => {
        installKeys();
        Element.prototype.scrollIntoView = jest.fn();
        window.scrollTo = jest.fn() as any;
    });

    it('finds the next and previous post by the scroll position', () => {
        const c = cards(-700, -100, 16, 500);
        expect(stepTarget(c, 1)?.id).toBe('p3');
        expect(stepTarget(c, -1)?.id).toBe('p1');
        expect(stepTarget(cards(16, 400), -1)).toBeUndefined();
    });

    it('steps from the marked post while it is visible', () => {
        const c = cards(16, 400, 800);
        c[1].classList.add('wp-current');
        expect(stepTarget(c, 1)?.id).toBe('p2');
        expect(stepTarget(c, -1)?.id).toBe('p0');
    });

    it('marks and scrolls to the post on j/k/n/p, but not in fields or with modifiers', () => {
        cards(16, 250, 500); // all visible: the marked post decides
        const key = (key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body) =>
            target.dispatchEvent(new KeyboardEvent('keydown', {key, bubbles: true, cancelable: true, ...init}));
        key('j');
        expect(document.querySelector('.wp-current')?.id).toBe('p1');
        key('n');
        expect(document.querySelector('.wp-current')?.id).toBe('p2');
        key('k', {ctrlKey: true});
        expect(document.querySelector('.wp-current')?.id).toBe('p2');
        const input = document.body.appendChild(document.createElement('input'));
        key('p', {}, input);
        expect(document.querySelector('.wp-current')?.id).toBe('p2');
        key('p');
        expect(document.querySelector('.wp-current')?.id).toBe('p1');
        key('n');
        key('n');
        expect(window.scrollTo).toHaveBeenCalled();
    });
});
