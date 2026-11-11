#!/usr/bin/env bash
# Downloads the official question PDFs from roadpolice.am into ../raw/pdf
set -euo pipefail
cd "$(dirname "$0")/.."
for set in abc dt; do for lang in hy ru en; do
  mkdir -p raw/pdf/$set/$lang
  for i in $(seq 1 10); do
    curl -sSL --fail -o raw/pdf/$set/$lang/$i.pdf "https://roadpolice.am/exam/$set/$lang/$i.pdf"
  done
done; done
