#!/usr/bin/env bash
# Copies free-year assets, byte for byte, from where production serves them today (Supabase
# `question-assets` or the private R2 bucket) into the public `pastpaperprep-free` bucket under
# `images/<path>`. Needs `wrangler login` and a linked Supabase CLI; no keys are read from disk.
#
#   scripts/copy-free-public-assets.sh <list.tsv> <work-dir> [download|upload|verify]
#
# list.tsv comes from scripts/list-free-public-assets.mts. Each phase is resumable: files that
# already exist locally (download), are logged as uploaded (upload), or verified are skipped.
set -euo pipefail

LIST=$1 WORK=$2 PHASE=${3:-download}
JOBS=${JOBS:-12}
# The Supabase CLI reads its project link from supabase/.temp, which only the linked checkout has.
export SUPABASE_WORKDIR=${SUPABASE_WORKDIR:-$PWD}
mkdir -p "$WORK/files" "$WORK/log"
export WORK

download_one() {
  local source=$1 path=$2 out="$WORK/files/$2"
  [ -s "$out" ] && return 0
  mkdir -p "$(dirname "$out")"
  if [ "$source" = supabase ] && [ -s "$WORK/supabase-all/$path" ]; then
    # Bulk copy made first with `supabase storage cp -r ss:///question-assets/<bank>` (per-file
    # CLI calls are rate limited).
    cp "$WORK/supabase-all/$path" "$out"
  elif [ "$source" = supabase ]; then
    supabase --experimental storage cp "ss:///question-assets/$path" "$out" --linked --workdir "$SUPABASE_WORKDIR" >/dev/null 2>&1
  else
    npx -y wrangler@4 r2 object get "pastpaperprep-assets/$path" --file "$out" --remote >/dev/null 2>&1
  fi
  [ -s "$out" ] || { rm -f "$out"; echo "$path" >> "$WORK/log/download-failed.txt"; }
}

upload_one() {
  local path=$2 file="$WORK/files/$2" type=image/webp
  grep -qxF "$path" "$WORK/log/uploaded.txt" 2>/dev/null && return 0
  [[ $path == *.json ]] && type=application/json
  if npx -y wrangler@4 r2 object put "pastpaperprep-free/images/$path" --file "$file" --remote \
      --content-type "$type" --cache-control "public, max-age=604800" >/dev/null 2>&1; then
    echo "$path" >> "$WORK/log/uploaded.txt"
  else
    echo "$path" >> "$WORK/log/upload-failed.txt"
  fi
}

verify_one() {
  local path=$2 file="$WORK/files/$2"
  local remote local_sum
  local_sum=$(shasum -a 256 "$file" | cut -d' ' -f1)
  remote=$(curl -sf --doh-url https://1.1.1.1/dns-query "https://free.pastpaperprep.com/images/$path" | shasum -a 256 | cut -d' ' -f1) || remote=missing
  [ "$remote" = "$local_sum" ] && echo "$path" >> "$WORK/log/verified.txt" || echo "$path" >> "$WORK/log/verify-failed.txt"
}

export -f download_one upload_one verify_one
rm -f "$WORK/log/$PHASE-failed.txt" "$WORK/log/verified.txt"
tr '\t' ' ' < "$LIST" | xargs -P "$JOBS" -L 1 bash -c "${PHASE}_one \$0 \$1"
failed=0; [ -f "$WORK/log/$PHASE-failed.txt" ] && failed=$(wc -l < "$WORK/log/$PHASE-failed.txt"); echo "$PHASE done; failures: $failed"
