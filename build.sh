#!/bin/sh
# Static build for GitHub Pages: ./build.sh [X.Y.Z] -> dist/
# The version lives in ONE place: package.json "version" (Brizna style X.Y.ZZ, e.g. 1.5.03).
#   ./build.sh          bumps the patch (1.5.02 -> 1.5.03, 1.4.99 -> 1.5.00), writes it to package.json
#                       and to spa-public/sw.js (VERSION = "brizna-X.Y.ZZ"), then builds.
#   ./build.sh 1.6.00   uses that version instead of bumping.
#   KEEP=1 ./build.sh   rebuilds the current version without bumping (a second build of the same release).
set -e
cd "$(dirname "$0")"
V=$(node scripts/bz-version.mjs "${1:-}")
echo "Brizna $V"
npx vite build -c vite.spa.config.ts
cd dist
grep -q "\"brizna-$V\"" sw.js || { echo "dist/sw.js is not brizna-$V"; exit 1; }
ls | grep -v -e '^sw.js$' -e '^precache.json$' | python3 -c "import sys,json;print(json.dumps(['./'+l.strip() for l in sys.stdin if l.strip()]))" > precache.json
touch .nojekyll
# The Pages branch (main) serves this folder as is; its .gitignore keeps secrets and stray builds out of it.
printf '%s\n' '# Brizna Pages (main): only the built app is committed here.' '.env' '.env.*' '*.p12' '*.jks' '*.keystore' '*.pem' '*.key' 'node_modules/' 'dist/' 'dist-*/' '*.tgz' > .gitignore
ls -la
