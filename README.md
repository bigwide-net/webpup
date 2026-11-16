# webpup

A single-page website for a domain with a [Personal Upload Server](../RFCs/RFC-6-Personal-Upload-Server.md)
(PUPS). Apps write the owner's feeds and profile through PUPS; webpup turns them into a web page,
in the visitor's browser, without any server code:

- the profile header: banner, avatar, name, summary (from `host-meta.json`), a reader-independent
  **Follow** button and an email button (from `contact.vcf`);
- **Posts**: every post of `/feed.json`, rendered like Downread's reader (images, audio and video,
  embeds), with archive pages for feeds that have archives ([RFC-7](../RFCs/RFC-7-Feed-Publishing-with-PUPS.md));
- one tab per further feed registered in `host-meta.json` (`/feed/<name>.json`);
- **Following**, **About** and **Contact** from the [SocialSpec](https://socialspec.org) files;
- **pages**: Markdown files registered in `host-meta.json`, as a tab of their own or on a **Pages** tab;
- a **footer** from a Markdown file, on every page;
- optionally a **theme selector** with ten themes to try.

## Files

| File | |
| --- | --- |
| `index.html` | The page. Loads the three files below by absolute path, so webpup must be at the domain root. |
| `webpups.js` | The script (about 100 KB). |
| `webpup.css` | The default look, light and dark. |
| `theme.css` | Empty. Replace it with a theme (see `themes/`) or your own CSS. |
| `webpup-themes/` | Optional: the themes for the theme selector (`index.json`, `<id>.css`, `<id>.jpg`). |
| `webpup-config.json` | Optional settings, see below. Not in `dist/`: without it, the page shows the theme selector. |

`npm run build` writes them to `dist/`.

## Installing

Copy the files from `dist/` to the root of the domain, next to `/feed.json` and `/.well-known/`.
A new site then shows the theme selector at the bottom of the page: pick a theme, copy it to
`theme.css`, and add a `webpup-config.json` (e.g. `{}`) to remove the selector. `webpup-themes/` can
be left out (or deleted afterwards); the selector then doesn't appear.
This is done by whoever installs PUPS (or by the PUPS server itself), not through PUPS: apps can't
upload HTML, JavaScript or CSS.

The web server must serve the four files as they are: with their normal content types, and without
the `Content-Security-Policy: sandbox` that PUPS puts on uploaded files (it would stop the script).
Two optional things make the URLs nicer:

- **`/` serves `/index.html`.** Otherwise the start page is `/index.html`.
- **`/p/*` serves `/index.html`** (an internal rewrite, not a redirect). Then pages have URLs like
  `/p/about` instead of `/index.html?show=about`.

```nginx
location = / { try_files /index.html =404; }
location /p/ { try_files /index.html =404; }
```

```apache
DirectoryIndex index.html
RewriteEngine On
RewriteRule ^p/ /index.html [L]
```

```caddy
rewrite /p/* /index.html
```

webpup finds out by itself what the server does: it requests `/p/webpup-probe` and `/` and checks
whether they return its `index.html` (by the `<meta name="generator" content="webpup">` line, so
keep it). The answer is kept in the browser's localStorage for 7 days.

## URLs

| Page | With the `/p/*` rewrite | Without |
| --- | --- | --- |
| Start page: the profile and the main feed | `/` | `/index.html` |
| About, Following, Contact | `/p/about`, `/p/following`, `/p/contact` | `/index.html?show=about`, … |
| Archive page 3 of the main feed | `/p/blog/archive/3` | `/index.html?show=blog&mode=archive&page=3` |
| Named feed `photos` | `/p/feed/photos` | `/index.html?show=feed&feed=photos` |
| Archive page 3 of `photos` | `/p/feed/photos/archive/3` | `/index.html?show=feed&feed=photos&mode=archive&page=3` |
| The Pages tab | `/p/pages` | `/index.html?show=pages` |
| The page `imprint.md` | `/p/page/imprint` | `/index.html?show=page&name=imprint` |
| A post | its page + `#<item id>` | the same |

- Both forms always work; webpup switches the address bar to the one the server supports.
- `/p/blog/…` is the main feed and `/p/feed/<name>/…` are the named feeds, so feeds can have any
  name, also `about` or `archive`.
- Archive pages are numbered like the archive files: page 3 is `feed.000003.json`. The numbers
  never change, so links to an archive page, and to the posts on it (`#id`), stay valid forever
  (RFC-7: "the archive's URL plus `#id` addresses an item forever"). Page 0 holds the oldest posts.
- Links to pages of the site don't reload the page: webpup changes the URL with `pushState` and
  renders the new page (Back and Forward work, and restore the scroll position).

## Keyboard

In a feed, **j** or **n** goes to the next post and **k** or **p** to the previous one: the post is
scrolled to the top of the window and marked. After the last post, the page scrolls to the pager
(Older posts). The keys do nothing while the follow dialog is open or a text field has the focus.

## What it reads

All from the site's own origin, in parallel:

- `/.well-known/host-meta.json`: the feeds (links with `rel` `https://bigwide.net/ns/feed` to
  `/feed/<name>.json` on this site; others, like feeds on other domains or RSS feeds, are ignored)
  and the [site properties](../RFCs/RFC-6-Personal-Upload-Server.md#site-properties):

  | Property | Used for |
  | --- | --- |
  | `https://bigwide.net/ns/title` | The site's name in the header and the page title |
  | `https://bigwide.net/ns/name` | The same, if there is no title; next to the domain if there is one |
  | `https://bigwide.net/ns/summary` | The line under the name, and the page's meta description |
  | `https://bigwide.net/ns/avatar` | The avatar. Without it, the avatar stays empty: no guessing from icons. |
  | `https://bigwide.net/ns/banner` | The banner. Without it, a band in the accent color. |
  | `https://bigwide.net/ns/theme-color` | The accent color, unless `theme.css` has any rules |
  | `https://bigwide.net/ns/language` | `<html lang>` |

  Without a title or name, the name comes from `contact.vcf`, then the main feed's title, then the
  domain; without a summary, from `about.md`'s `summary`, then the main feed's description.
- The **pages**: links with `rel` `https://bigwide.net/ns/webpup-pages` to Markdown files on this
  site. See [Pages and footer](#pages-and-footer).
- The **footer**: the Markdown file of the property `https://bigwide.net/ns/webpup-footer`.
- `/feed.json`, registered or not, and the registered named feeds. Archives
  (`_pups.archive_url`) are loaded when an archive page is opened. Feeds without `archive_url` have
  no archive pages.
- `/.well-known/about.md`, `following.opml`, `contact.vcf`. A tab shows only if its file exists.
- `/webpup-config.json`, if it exists.

## Pages and footer

Markdown files of the site become pages when `host-meta.json` links them. Apps publish them through
PUPS: the files go into the well-known directory `/pups/pages/`, and the host-meta endpoint adds the
links (with `titles` and `webpup-hidden`), orders them and sets the footer (RFC-6, "Pages"). The
owner can also edit `host-meta.json` by hand.

```json
{
  "links": [
    { "rel": "https://bigwide.net/ns/webpup-pages", "type": "text/markdown", "href": "https://tim.example.com/pups/pages/now.md" },
    { "rel": "https://bigwide.net/ns/webpup-pages", "type": "text/markdown", "href": "https://tim.example.com/pups/pages/uses.md",
      "titles": { "default": "Uses" } },
    { "rel": "https://bigwide.net/ns/webpup-pages", "type": "text/markdown", "href": "https://tim.example.com/pups/pages/imprint.md",
      "properties": { "https://bigwide.net/ns/webpup-hidden": "true" } }
  ],
  "properties": {
    "https://bigwide.net/ns/webpup-footer": "https://tim.example.com/pups/pages/footer.md"
  }
}
```

- **Tabs.** One listed page is a tab of its own (after About, like it); with several, a **Pages**
  tab lists them.
- **Order.** The order of the links in `host-meta.json`, as RFC 7033 allows ("the order of
  elements in the links array MAY be interpreted as indicating an order of preference").
- **Hidden pages.** A link with the property `https://bigwide.net/ns/webpup-hidden` set to `"true"`
  is a page with its own URL, but neither a tab nor on the Pages tab: e.g. an imprint that only the
  footer links to.
- **Titles.** The link's `titles` (the site's language, else `default`, else any), else the first
  heading of the file, else its file name. The file name is also the page's name in URLs
  (`imprint.md` is `/p/page/imprint`).
- **Footer.** The Markdown file of `https://bigwide.net/ns/webpup-footer`, shown at the bottom of
  every page.
- **Links** in the site's Markdown (pages, footer, `about.md`) to the Markdown file of a page go to
  that page, e.g. `[Imprint](/pups/pages/imprint.md)`. Links to the site open in the same tab,
  others in a new one.
- Only files on the site's own origin are used. They are rendered by `t-lib-postviewer`'s Markdown
  renderer, without raw HTML.

## Configuration

`webpup-config.json`:

```json
{ "embeds": "on", "theme-selector": false }
```

- `embeds`: what happens with YouTube videos, embedded posts (X, Instagram, Bluesky, …) and other
  third-party content in the posts. `"on"` (default): shown at once, as the owner put them in their
  feed. `"consent"`: behind an overlay until the visitor allows the service (remembered in their
  browser). `"off"`: video players are removed, embedded posts stay plain quotes.
- `theme-selector`: shows the theme selector above the footer, a row of the themes in
  `/webpup-themes/`. A click puts a theme on the page until it is reloaded; the text under the row
  says which file to copy to `theme.css` to keep it. **On while there is no `webpup-config.json`**,
  so a new site shows it; with a config file, only if it says `true`.

## Themes

Every color, font and size of `webpup.css` is a `--wp-*` custom property (listed at the top of
`src/webpup.css`), and `theme.css` is loaded after it. A theme is a `theme.css` that sets them, or
restyles anything else (`wp-*` page classes, `post*` post classes, `fd-*` follow dialog). Dark mode
follows the system unless `<html data-theme="light|dark">` says otherwise.

`themes/` has ten themes, from new colors (Night, Pastel) to another layout (Sidebar) and the
silly (Retro). See [themes/README.md](themes/README.md).

## The Follow button

The follow dialog of rssdirectory.org and sodir.org (`lib/follow`): the visitor picks their reader
(Downread first, then Feedbin, Feedly, Inoreader, NetNewsWire, NewsBlur, HyperTexting on iOS, or a
custom subscribe URL), webpup opens the feed there; "Remember" makes the next Follow go straight to
it. The feed URL can also be copied. The list is `READERS` in `src/follow.ts`. **TODO:** check that
every listed reader subscribes to JSON Feeds (RFC-7 feeds are JSON only), and drop those that don't.

## Development

```bash
bin/dev.sh               # debug build + dev server on :8095 with the example site, plain URLs
bin/dev.sh --rewrite     # ... with the /p/* rewrite (pretty URLs)
bin/dev.sh --rewrite --port 8096 --theme themes/night.css --no-root --data ../my-site
npm test                 # jest (jsdom)
npm run typecheck
npm run build            # production build into dist/
node scripts/make-example.mjs   # regenerate example/
node scripts/make-thumbnails.mjs [theme ...]   # theme thumbnails into themes/thumbs/ (needs a build)
```

The dev server (`scripts/serve.mjs`) serves webpup from `dist/` and the site's files from
`example/` the way PUPS serves uploads (CORS, `CSP: sandbox`, `no-cache`), and replaces
`https://tim.example` in them with its own origin. webpup remembers the URL style per origin for 7
days: to compare both modes, run them on different ports.

### Source

TypeScript in `src/`, bundled with esbuild:

- `router.ts`: the URL scheme (both styles), detecting the server's style, navigation without
  reload (like Downread's router, `t-lib-ui/router`).
- `data.ts`: loading `host-meta.json`, the SocialSpec files, the feeds and archives, the config.
- `jsonfeed.ts`: JSON Feed items (with `_source`, `_image`) as posts of `t-lib-postviewer`.
- `view.ts`: header, tabs, About/Following/Contact; `posts.ts`: the feed and archive pages.
- `follow.ts`: the follow dialog's markup and the Follow button.
- `themes.ts`: the theme color, and the theme selector.

It uses three libraries of the `t` repository, expected at `../../t/lib` (`@lib/*` in
`tsconfig.json` and `jest.config.js`): `postviewer` (post rendering and sanitizing with DOMPurify,
Markdown), `socialspec` (the about.md, OPML and vCard parsers) and `follow` (the follow dialog).

## Not done yet

- Comments of feeds with RFC-4 submissions (`t-lib-postviewer` can render them).
- Search engines see the page only after running the script; `index.html` has no content of its own.
