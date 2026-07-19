#!/usr/bin/env python3
"""
Has the exported dashboard data MEANINGFULLY changed since the last commit?

update_stats.sh already tried to answer this with `git diff --quiet`, but that
never worked: the exporter stamps a fresh generated_at / last_updated on every
run, so the files always differ and the skip never fired. Result was a commit
every interval whether or not a post had arrived - 14,871 of them, and a 559 MB
.git for a static dashboard.

This compares the data with ONLY those generation timestamps removed. Everything
else is left in deliberately:
  - today.date            rolls at midnight, a real change
  - launch.days_active    increments daily, a real change
  - last_24h              rolling window, changes as posts age out, a real change
Those all alter what a visitor sees, so they deserve a commit.

Exit codes (shell-friendly):
    0  changed   -> commit and push
    1  unchanged -> discard the regenerated files, do not commit

Usage:  data_changed.py <file> [<file> ...]
Compares each against its committed version at HEAD, in the current git repo.
"""
import json
import subprocess
import sys

# Fields that change on every single export regardless of the underlying data.
VOLATILE_TOP_LEVEL = {"generated_at", "last_updated"}


def strip_volatile(obj):
    """Return the data with generation timestamps removed."""
    if not isinstance(obj, dict):
        return obj
    return {k: v for k, v in obj.items() if k not in VOLATILE_TOP_LEVEL}


def committed_version(path):
    """The file as it exists at HEAD, or None if it is not committed yet."""
    try:
        out = subprocess.run(
            ["git", "show", "HEAD:%s" % path],
            capture_output=True, check=True,
        ).stdout
        return json.loads(out.decode("utf-8"))
    except Exception:
        return None


def working_version(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def main(paths):
    changed = []
    for path in paths:
        old = committed_version(path)
        if old is None:
            # Never committed, or unreadable at HEAD - treat as changed so a new
            # file is never silently withheld.
            changed.append("%s (no committed version)" % path)
            continue
        try:
            new = working_version(path)
        except Exception as exc:
            # A malformed export must NOT be committed over a good one.
            print("  %s: unreadable (%s) - treating as UNCHANGED to protect the "
                  "committed copy" % (path, exc))
            continue
        if strip_volatile(old) != strip_volatile(new):
            changed.append(path)

    if changed:
        print("  meaningful change in: %s" % ", ".join(changed))
        return 0
    print("  no meaningful change - only generation timestamps moved")
    return 1


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1:]))
