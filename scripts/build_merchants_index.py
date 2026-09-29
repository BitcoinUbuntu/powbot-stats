"""
Build merchants-index.json: every merchant from finished epochs, for the
Directory's Merchants tab (merchants.html).

For each merchant: its country, the projects that posted there, approved
posts per epoch and the date of its first post. Counts only: no amounts.
The page adds the live epoch from stats.json itself.

Loading the frozen epoch files on the page would cost phones well over a
megabyte; this index is a fraction of that. Merchant names come from BTC Map,
so the same shop has the same name in every epoch and an exact match is
enough. Epochs 1-3 recorded no merchants. The Epoch 4 testing period (in
stats-historical.json) is kept apart as "4t", as the archive shows it, so
"Epoch 4" here matches the archive's Epoch 4 lists.

==> AT EACH EPOCH ROLLOVER: after freezing stats.json as stats-epochN.json,
    run this from the repo root and commit the result:

        python scripts/build_merchants_index.py
"""

import glob
import json
import os
import re
from collections import Counter
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FLAG_RE = re.compile(r"[\U0001F1E6-\U0001F1FF]{2}")


def epoch_number(path):
    match = re.search(r"stats-epoch(\d+)\.json$", path)
    return int(match.group(1)) if match else None


def flag_of(name):
    match = FLAG_RE.search(name or "")
    return match.group(0) if match else ""


def strip_flags(name):
    return FLAG_RE.sub("", name or "").strip()


def main():
    merchants = {}
    country_by_flag = {}
    sources = []

    def add(epoch, data):
        for c in data.get("countries") or []:
            if c.get("flag") and c.get("country"):
                country_by_flag[c["flag"]] = c["country"]
        for m in data.get("top_merchants") or []:
            name = m.get("name")
            if not name:
                continue
            entry = merchants.setdefault(name, {"epochs": Counter(), "projects": Counter(), "flags": Counter(), "first": ""})
            posts = m.get("posts") or []
            entry["epochs"][str(epoch)] += m.get("count", len(posts))
            for p in posts:
                project = p.get("project")
                if project:
                    entry["projects"][strip_flags(project)] += 1
                    entry["flags"][flag_of(project)] += 1
                date = p.get("date") or ""
                if date and (not entry["first"] or date < entry["first"]):
                    entry["first"] = date

    # Frozen epochs: stats-epoch4.json, stats-epoch5.json, ...
    frozen = sorted(
        (p for p in glob.glob(os.path.join(ROOT, "stats-epoch*.json")) if epoch_number(p)),
        key=epoch_number,
    )
    for path in frozen:
        with open(path, encoding="utf-8") as f:
            add(epoch_number(path), json.load(f))
        sources.append(os.path.basename(path))

    # The Epoch 4 testing period, kept in stats-historical.json
    historical_path = os.path.join(ROOT, "stats-historical.json")
    if os.path.exists(historical_path):
        with open(historical_path, encoding="utf-8") as f:
            testing = json.load(f).get("epochs", {}).get("epoch4_testing")
        if testing and testing.get("top_merchants"):
            add("4t", testing)
            sources.append("stats-historical.json (epoch4_testing)")

    rows = []
    for name, e in merchants.items():
        flag = e["flags"].most_common(1)[0][0] if e["flags"] else ""
        rows.append({
            "name": name,
            "flag": flag,
            "country": country_by_flag.get(flag, ""),
            # Most posts first
            "projects": [p for p, _ in e["projects"].most_common()],
            # In order, the testing period ("4t") before Epoch 4 itself
            "epochs": dict(sorted(e["epochs"].items(), key=lambda kv: float(kv[0].replace("t", "")) - kv[0].endswith("t") * 0.5)),
            "first": e["first"],
        })
    rows.sort(key=lambda r: r["name"].casefold())

    out = {
        "description": "Merchants from finished epochs, for the Directory's Merchants tab "
                       "(merchants.html): country, projects, approved posts per epoch and "
                       "first post date. Counts only. Rebuild at each epoch rollover with "
                       "scripts/build_merchants_index.py.",
        "through_epoch": max((epoch_number(p) for p in frozen), default=None),
        "sources": sources,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "merchants": rows,
    }
    with open(os.path.join(ROOT, "merchants-index.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    no_country = sum(1 for r in rows if not r["country"])
    print(f"merchants-index.json: {len(rows)} merchants from {', '.join(sources)}"
          f"{f'; {no_country} without a country' if no_country else ''}")


if __name__ == "__main__":
    main()
