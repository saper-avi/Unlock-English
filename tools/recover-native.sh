#!/usr/bin/env sh
# Requires a locally installed JADX; does not download or run code from the APK.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
if ! command -v jadx >/dev/null 2>&1; then
  echo "JADX is not installed. Install it from its official project, then rerun this command." >&2
  exit 1
fi
if [ -e "$ROOT/recovery/jadx" ]; then
  echo "recovery/jadx already exists; refusing to overwrite it." >&2
  exit 1
fi
mkdir -p "$ROOT/recovery"
jadx -d "$ROOT/recovery/jadx" "$ROOT/original/Unlock-English-0.1.0.apk"
echo "Inspect decompiled Java and resources in recovery/jadx. A successful decompilation is not proof of a buildable Android project."
