# Scripts

Run these from the repo root. They use only the Python standard library unless noted.

| Script | What it does | When |
|---|---|---|
| `build_merchants_seen.py` | Writes `merchants-seen.json`, the merchant names from finished epochs (the homepage marks new ones) | Every epoch rollover, after freezing `stats.json` |
| `build_merchants_index.py` | Writes `merchants-index.json`, the index behind the Directory's Merchants tab | Every epoch rollover |
| `data_changed.py` | Says whether the exported data has meaningfully changed since the last commit, ignoring generation timestamps | Used by the server's twice-daily stats job: do not remove |

Commit the generated JSON files.
