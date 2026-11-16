# webpup themes

A theme is a `theme.css` that replaces the empty one next to `index.html`. Copy one of these files
over `/theme.css`, or write your own. webpup loads it after `webpup.css`, so it can override any
rule; most themes only set the `--wp-*` tokens listed at the top of `webpup.css`.

| Theme | |
| --- | --- |
| `paper.css` | Warm paper, serif headings, square corners, no cards |
| `night.css` | Always dark, with a blue accent |
| `minimal.css` | No banner, no boxes, a narrow column and lots of white space |
| `newspaper.css` | Centered masthead, serif type, rules instead of cards, drop caps |
| `sidebar.css` | On wide screens, profile and tabs in a column on the left |
| `pastel.css` | Soft colors, round shapes, gentle shadows |
| `sunset.css` | Frosted glass cards on a warm gradient |
| `brutal.css` | Thick black lines, hard shadows, yellow |
| `terminal.css` | Green phosphor on black, all monospace |
| `retro.css` | A home page from 1998 |

- **Tokens on `:root:root`.** webpup's dark mode sets the tokens on
  `:root:not([data-theme="light"])`; the doubled `:root` gives a theme the same specificity, and
  coming later, it wins. A theme with its own dark variant puts it in
  `@media (prefers-color-scheme: dark) { :root:root { … } }`.
- **Theme color.** A theme color in `host-meta.json` (`https://bigwide.net/ns/theme-color`) is
  ignored as soon as `theme.css` has any rules.
- **Theme selector.** `themes.json` lists the themes in the selector's order. The build copies them
  with their thumbnails (`thumbs/<id>.jpg`, plus `default.jpg` for webpup's own look) to
  `dist/webpup-themes/`. `node scripts/make-thumbnails.mjs` makes the thumbnails from the example
  site (after `npm run build`).
