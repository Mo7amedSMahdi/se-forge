#!/bin/sh
# Contract check for CI (copy to ci/contract-check.sh in the repo that owns the spec):
#   lint (Redocly), breaking changes against the newest approved api-v<semver> tag (oasdiff), and the
#   version rule: a changed spec needs a higher info.version, a breaking change a new major.
#   In a pipeline for an api-v tag, the tag must equal api-v<info.version>.
# Needs git with full history and tags, node (npx), tar and curl; oasdiff is downloaded when missing.
# Usage: sh ci/contract-check.sh <spec path>
set -eu
SPEC="${1:?usage: contract-check.sh <spec path>}"
REDOCLY="npx --yes @redocly/cli@2.59.0"
OASDIFF_VERSION=1.33.0
TMP="$(mktemp -d)"
TAG="${CI_COMMIT_TAG:-}"

[ -n "${CI:-}" ] && git fetch --quiet --tags --force origin 2>/dev/null || true
$REDOCLY lint "$SPEC"
$REDOCLY bundle "$SPEC" --ext json -o "$TMP/rev.json"
VERSION="$(node -p "require('$TMP/rev.json').info.version")"
if [ -n "$TAG" ] && [ "$TAG" != "api-v$VERSION" ]; then echo "tag $TAG does not match info.version $VERSION" >&2; exit 1; fi

BASE="$(git tag -l 'api-v*' --sort=-v:refname | grep -E '^api-v[0-9]+\.[0-9]+\.[0-9]+$' | grep -vxF "${TAG:-none}" | head -n 1 || true)"
if [ -z "$BASE" ]; then echo "no approved version yet: $VERSION is the first"; exit 0; fi
mkdir -p "$TMP/base"
git archive "$BASE" -- "$(dirname "$SPEC")" | tar -x -C "$TMP/base"
$REDOCLY bundle "$TMP/base/$SPEC" --ext json -o "$TMP/base.json"

if ! command -v oasdiff >/dev/null 2>&1; then
  ARCH="$(uname -m | sed 's/x86_64/amd64/; s/aarch64/arm64/')"
  curl -fsSL "https://github.com/oasdiff/oasdiff/releases/download/v$OASDIFF_VERSION/oasdiff_${OASDIFF_VERSION}_linux_$ARCH.tar.gz" | tar -xz -C "$TMP" oasdiff
  PATH="$TMP:$PATH"
fi
set +e
oasdiff breaking "$TMP/base.json" "$TMP/rev.json" --fail-on ERR
BREAKING=$?
set -e
[ "$BREAKING" -le 1 ] || exit "$BREAKING"

node - "$TMP/base.json" "$TMP/rev.json" "$BREAKING" "$BASE" <<'JS'
const fs = require('fs');
const [baseFile, revFile, breaking, baseTag] = process.argv.slice(2);
const [b, r] = [baseFile, revFile].map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
const v = (s) => String(s).split('.').map(Number);
const [bv, rv] = [v(b.info.version), v(r.info.version)];
const cmp = (x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
const strip = (o) => JSON.stringify({ ...o, info: { ...o.info, version: null } });
if (strip(b) === strip(r)) { console.log(`contract unchanged since ${baseTag}`); process.exit(0); }
if (breaking === '1' && rv[0] <= bv[0]) { console.error(`breaking change since ${baseTag}: info.version must be ${bv[0] + 1}.0.0 or higher (it is ${r.info.version})`); process.exit(1); }
if (cmp(rv, bv) <= 0) { console.error(`the contract changed since ${baseTag}: raise info.version above ${b.info.version}`); process.exit(1); }
console.log(`contract ${r.info.version} ok against ${baseTag}${breaking === '1' ? ' (breaking, new major)' : ''}`);
JS
