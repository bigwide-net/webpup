#!/bin/bash
# Builds webpup (debug build, readable, with a source map) and serves it with the example site.
#
#   bin/dev.sh              plain static server: URLs like /index.html?show=about
#   bin/dev.sh --rewrite    the server rewrites /p/* to index.html: URLs like /p/about
#   bin/dev.sh --rewrite --port 8096 --theme themes/paper.css --no-root --data ../my-site
#
# webpup remembers the URL style for 7 days (localStorage of the origin). To test the other mode,
# use another port, or clear the site data in the browser.
set -e
cd "$(dirname "$0")/.."
[ -d node_modules ] || npm install
# The shared libraries: bigwide-net/lib, next to this repository.
[ -d ../lib ] || git clone https://github.com/bigwide-net/lib ../lib
[ -d ../lib/node_modules ] || (cd ../lib && npm install)
[ -f example/feed.json ] || node scripts/make-example.mjs
node scripts/build.mjs debug
exec node scripts/serve.mjs "$@"
