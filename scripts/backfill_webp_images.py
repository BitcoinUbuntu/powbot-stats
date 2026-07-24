#!/usr/bin/env python3
"""
One-time backfill: downsize + re-encode the member image library to WebP.

New uploads are already handled at the chokepoint in the profile API
(powbot-profile-api/image_processing.py, live 24 July 2026). This converts the
images that predate it - measured at 362 MB across 260 files, with single
gallery images up to 14.8 MB at 6000x4000, displayed in a ~300px carousel.

DRY RUN BY DEFAULT. Pass --apply to actually change anything.

    python scripts/backfill_webp_images.py            # report only
    python scripts/backfill_webp_images.py --apply    # convert

Scope is images/members/ ONLY. Site chrome in images/ is deliberately excluded:
images/PoWBoT_preview.jpg is the Open Graph card, and some social scrapers still
handle WebP poorly, so a smaller file is not worth a broken link preview. The
favicons are a couple of KB and have nothing to gain.

SAFETY
------
- Encodes in memory and verifies the result decodes before anything is written.
- Writes every new file first, then updates members.json atomically, and only
  then deletes originals - so an interruption leaves both copies and a valid
  members.json rather than a dangling reference.
- Anything that fails to convert is left completely alone, original intact and
  still referenced.
- The whole tree is git-tracked, so `git checkout -- images members.json` is a
  full undo.
"""

import argparse
import io
import json
import os
import shutil
import sys
import tempfile

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("Pillow is required:  pip install Pillow")

# Pillow refuses very large files by default as a decompression-bomb guard.
# These are known-good member photos, so lift it.
Image.MAX_IMAGE_PIXELS = None

# MUST match powbot-profile-api/image_processing.py, or backfilled images and
# newly uploaded ones end up at different sizes.
LOGO_MAX_EDGE = 800
GALLERY_MAX_EDGE = 1600
WEBP_QUALITY = 82
WEBP_METHOD = 6

MEMBERS_JSON = "members.json"
IMAGE_ROOT = "images/members"


def norm(p):
    return p.replace(os.sep, "/")


def has_alpha(img):
    return img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)


def encode_webp(path, max_edge):
    """Return (bytes, (w, h), (orig_w, orig_h)) or None if it cannot be processed."""
    try:
        img = Image.open(path)
        img.load()
        original = img.size
        img = ImageOps.exif_transpose(img)
        img = img.convert("RGBA" if has_alpha(img) else "RGB")
        img.thumbnail((max_edge, max_edge), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, "WEBP", quality=WEBP_QUALITY, method=WEBP_METHOD)
        data = buf.getvalue()
        # Verify it decodes before we ever consider deleting the original.
        check = Image.open(io.BytesIO(data))
        check.load()
        return data, img.size, original
    except Exception as exc:
        print(f"    !! cannot process {path}: {exc}")
        return None


def collect(members):
    """Map every referenced image to its owner field so we can repoint it."""
    refs = []  # (path, member_index, field, gallery_index)
    for i, m in enumerate(members):
        if m.get("logo_url"):
            refs.append((norm(m["logo_url"]), i, "logo_url", None))
        for gi, g in enumerate(m.get("gallery") or []):
            refs.append((norm(g), i, "gallery", gi))
    return refs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="actually convert (default: dry run)")
    ap.add_argument("--limit", type=int, help="only process the first N images")
    args = ap.parse_args()

    if not os.path.exists(MEMBERS_JSON):
        sys.exit("Run this from the repo root (members.json not found).")

    data = json.load(open(MEMBERS_JSON, encoding="utf-8"))
    members = data["members"]
    refs = collect(members)

    on_disk = {
        norm(os.path.join(dp, f))
        for dp, _, fs in os.walk(IMAGE_ROOT)
        for f in fs
    }
    referenced = {r[0] for r in refs}

    todo = []
    skipped_missing = []
    already = []
    for path, mi, field, gi in refs:
        if not os.path.exists(path):
            skipped_missing.append(path)
            continue
        if path.lower().endswith(".webp"):
            already.append(path)
            continue
        todo.append((path, mi, field, gi))

    if args.limit:
        todo = todo[: args.limit]

    mode = "APPLY" if args.apply else "DRY RUN"
    print(f"=== WebP backfill [{mode}] ===\n")
    print(f"referenced images : {len(referenced)}")
    print(f"  to convert      : {len(todo)}")
    print(f"  already webp    : {len(already)}")
    print(f"  missing on disk : {len(skipped_missing)}")

    orphans = on_disk - referenced
    if orphans:
        osize = sum(os.path.getsize(p) for p in orphans)
        print(f"\norphans (on disk, referenced by nothing): {len(orphans)}  {osize/1024/1024:.1f} MB")
        for p in sorted(orphans, key=os.path.getsize, reverse=True)[:10]:
            print(f"    {p}  {os.path.getsize(p)/1024/1024:.1f}MB")
        print("  -> left untouched. Delete by hand if they are not wanted.")

    print()
    old_total = new_total = 0
    converted = []   # (old_path, new_path, bytes, mi, field, gi)
    failed = []

    for path, mi, field, gi in todo:
        base = os.path.basename(path).lower()
        cap = LOGO_MAX_EDGE if "logo" in base else GALLERY_MAX_EDGE
        result = encode_webp(path, cap)
        old = os.path.getsize(path)
        old_total += old
        if not result:
            failed.append(path)
            new_total += old  # unchanged
            continue
        blob, newsize, orig = result
        new_total += len(blob)
        new_path = os.path.splitext(path)[0] + ".webp"
        if new_path != path and os.path.exists(new_path):
            print(f"    !! target exists, skipping: {new_path}")
            failed.append(path)
            continue
        converted.append((path, new_path, blob, mi, field, gi))
        if old > 1_000_000:
            print(
                f"  {path}\n"
                f"      {orig[0]}x{orig[1]} {old/1024/1024:>6.1f}MB "
                f"-> {newsize[0]}x{newsize[1]} {len(blob)/1024:>6.0f}KB  "
                f"(-{100 - len(blob)/old*100:.0f}%)"
            )

    print()
    print(f"current   : {old_total/1024/1024:>8.1f} MB")
    print(f"projected : {new_total/1024/1024:>8.1f} MB")
    if old_total:
        print(f"saved     : {(old_total-new_total)/1024/1024:>8.1f} MB  ({100 - new_total/old_total*100:.1f}%)")
    if failed:
        print(f"\nfailed (left untouched): {len(failed)}")
        for p in failed[:10]:
            print("   ", p)

    if not args.apply:
        print("\nDRY RUN - nothing written. Re-run with --apply to convert.")
        return

    if not converted:
        print("\nNothing to do.")
        return

    print(f"\nWriting {len(converted)} new files...")
    written = []
    for old_path, new_path, blob, mi, field, gi in converted:
        with open(new_path, "wb") as fh:
            fh.write(blob)
        written.append(new_path)

    # Repoint members.json, then write it atomically. Only after this succeeds do
    # we delete originals - so a crash here leaves both files and a members.json
    # that still points at something real.
    for old_path, new_path, _blob, mi, field, gi in converted:
        if field == "logo_url":
            members[mi]["logo_url"] = new_path
        else:
            members[mi]["gallery"][gi] = new_path

    fd, tmp = tempfile.mkstemp(dir=".", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2, ensure_ascii=False)
            fh.write("\n")
        shutil.move(tmp, MEMBERS_JSON)
    except Exception:
        if os.path.exists(tmp):
            os.unlink(tmp)
        print("!! members.json update FAILED - removing the new files just written")
        for p in written:
            if os.path.exists(p):
                os.unlink(p)
        raise

    removed = 0
    for old_path, new_path, _blob, _mi, _field, _gi in converted:
        if old_path != new_path and os.path.exists(old_path):
            os.unlink(old_path)
            removed += 1

    print(f"done. {len(converted)} converted, {removed} originals removed, members.json repointed.")
    print("Check `git status`, then verify a profile page before committing.")


if __name__ == "__main__":
    main()
