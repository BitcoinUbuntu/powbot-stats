"""One-off: Epoch 4's approved posts as tracker archives.

Epoch 4 predates the tracker export, so its posts survive only in the stats
files: stats-epoch4.json (Epoch 4 proper, 1,698 posts) and the testing period
in stats-historical.json (epoch4_testing, 187 posts). Each post there has a
URL, a date, a project and a merchant, nothing more: no time, no review
detail and no payments. This writes them in the tracker's shape:

    tracker-data-epoch4.json    Epoch 4
    tracker-data-epoch4t.json   the Epoch 4 testing period ("4t", as the
                                archive and the merchants index keep it)

Every row is an approved post, so its status is "Processed". Timestamps are
dates only (YYYY-MM-DD); tracker.js shows them without a time. Project names
take the tracker's "Name (Country) flag" form from members.json.

Reads only this repo's JSON. Never touches the bot's database: no amounts.

Run from the repo root:  python scripts/build_tracker_epoch4.py
"""
import json
import sys
from datetime import date

FLAG_ONLY = "Name 🇰🇪"  # the stats files' form, for the error message


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


members = load("members.json")
members = members["members"] if isinstance(members, dict) else members
by_name = {m["name"].strip().lower(): m for m in members}


def project(stats_name):
    """'Bitbiashara 🇰🇪' -> ('Bitbiashara (Kenya) 🇰🇪', '🇰🇪')."""
    parts = stats_name.rsplit(" ", 1)
    name, flag = (parts[0], parts[1]) if len(parts) == 2 and not parts[1].isascii() else (stats_name, "")
    member = by_name.get(name.strip().lower())
    if not member:
        return None
    return member["name_with_flag"], member.get("flag") or flag


def platform(url):
    host = url.split("/")[2].lower() if "://" in url else ""
    return "X" if host.endswith(("x.com", "twitter.com")) else "Nostr"


def rows(top_projects, key):
    out, missing = [], set()
    for p in top_projects:
        named = project(p["name"])
        if not named:
            missing.add(p["name"])
            continue
        for post in p["posts"]:
            out.append({
                "id": None,
                "timestamp": post["date"],
                "project_name": named[0],
                "project_flag": named[1],
                "merchant_name": post.get("merchant") or "",
                "platform": platform(post["url"]),
                "post_url": post["url"],
                "status": "Processed",
            })
    # Newest first, then numbered from the oldest, like the bot's ids
    out.sort(key=lambda r: (r["timestamp"], r["post_url"]), reverse=True)
    for i, r in enumerate(out):
        r["id"] = f"e{key}-{len(out) - i}"
    return out, missing


def write(path, key, subs, source):
    data = {
        "last_updated": max(s["timestamp"] for s in subs),
        "total_submissions": len(subs),
        "submissions": subs,
        "epoch": key,
        "archived": date.today().isoformat(),
        "note": f"Built from {source} by scripts/build_tracker_epoch4.py. "
                "Approved posts only, dated to the day; no review detail or payments.",
    }
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"{path}: {len(subs)} posts, {subs[-1]['timestamp']} to {subs[0]['timestamp']}")


e4 = load("stats-epoch4.json")
testing = load("stats-historical.json")["epochs"]["epoch4_testing"]

problems = False
for path, key, top, source, expected in [
    ("tracker-data-epoch4.json", "4", e4["top_projects"], "stats-epoch4.json", sum(p["count"] for p in e4["top_projects"])),
    ("tracker-data-epoch4t.json", "4t", testing["top_projects"], "stats-historical.json (epoch4_testing)", testing["total_posts"]),
]:
    subs, missing = rows(top, key)
    if missing:
        problems = True
        print(f"{path}: no member for {sorted(missing)} (expected names like {FLAG_ONLY!r})", file=sys.stderr)
    if len(subs) != expected:
        problems = True
        print(f"{path}: {len(subs)} posts, expected {expected}", file=sys.stderr)
    write(path, key, subs, source)

sys.exit(1 if problems else 0)
