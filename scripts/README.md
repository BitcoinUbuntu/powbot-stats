# Scripts

Run these from the repo root. They use only the Python standard library unless noted.

| Script | What it does | When |
|---|---|---|
| `build_merchants_seen.py` | Writes `merchants-seen.json`, the merchant names from finished epochs (the homepage marks new ones) | Every epoch rollover, after freezing `stats.json` |
| `build_merchants_index.py` | Writes `merchants-index.json`, the index behind the Directory's Merchants tab | Every epoch rollover |
| `build_tracker_epoch4.py` | Rebuilds the Epoch 4 tracker archives from the stats files | One-off, kept as the record of how they were made |
| `backfill_webp_images.py` | Downsizes and converts member images to WebP. Dry run unless given `--apply` | One-off; new uploads are converted by the profile API |
| `data_changed.py` | Says whether the exported data has meaningfully changed since the last commit, ignoring generation timestamps | Used by the server's twice-daily stats job: do not remove |

Commit the generated JSON files. The epoch rollover checklist lists the full order.
