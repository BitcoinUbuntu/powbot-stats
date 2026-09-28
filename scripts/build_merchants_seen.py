"""
Build merchants-seen.json: every merchant name from finished epochs.

The homepage uses it to mark merchants that are new to PoWBoT in the current
epoch. Loading the frozen epoch files themselves would cost phones about
1.4 MB; this list is a few KB.

Merchant names come from BTC Map, so the same shop has the same name in every
epoch and an exact match is enough.

==> AT EACH EPOCH ROLLOVER: after freezing stats.json as stats-epochN.json,
    run this from the repo root and commit the result:

        python scripts/build_merchants_seen.py
"""

import glob
import json
import os
import re
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def epoch_number(path):
    match = re.search(r"stats-epoch(\d+)\.json$", path)
    return int(match.group(1)) if match else None


def main():
    names = set()
    sources = []

    # Frozen epochs: stats-epoch4.json, stats-epoch5.json, ...
    frozen = sorted(
        (p for p in glob.glob(os.path.join(ROOT, "stats-epoch*.json")) if epoch_number(p)),
        key=epoch_number,
    )
    for path in frozen:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        names.update(m["name"] for m in data.get("top_merchants", []) if m.get("name"))
        sources.append(os.path.basename(path))

    # Older epochs kept in stats-historical.json. Epochs 1-3 have no merchant
    # lists; only the Epoch 4 testing period does.
    historical_path = os.path.join(ROOT, "stats-historical.json")
    if os.path.exists(historical_path):
        with open(historical_path, encoding="utf-8") as f:
            historical = json.load(f)
        for key, epoch in historical.get("epochs", {}).items():
            merchants = epoch.get("top_merchants") or []
            if merchants:
                names.update(m["name"] for m in merchants if m.get("name"))
                sources.append(f"stats-historical.json ({key})")

    out = {
        "description": "Merchant names from finished epochs. The homepage marks any "
                       "current merchant not in this list as new. Rebuild at each epoch "
                       "rollover with scripts/build_merchants_seen.py.",
        "through_epoch": max((epoch_number(p) for p in frozen), default=None),
        "sources": sources,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "names": sorted(names, key=str.casefold),
    }
    with open(os.path.join(ROOT, "merchants-seen.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"merchants-seen.json: {len(out['names'])} names from {', '.join(sources)}")


if __name__ == "__main__":
    main()
