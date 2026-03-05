# PoWBoT Stats Dashboard

**See also:** `../CLAUDE.md` for master context and `../.brain/` for shared documentation.

---

## Overview

Public statistics dashboard for PoWBoT (Proof-of-Work Bot), a reward system for CBAF (Circular Bitcoin Africa Fund) projects. The bot pays Bitcoin (sats via Lightning) to projects, merchants, and reviewers when videos promoting Bitcoin adoption in Africa are approved.

**Status:** Active, Live
**URL:** https://bitcoinubuntu.github.io/powbot-stats/

---

## Project Structure

```
powbot-stats/
├── index.html          # Main dashboard (HTML + CSS + JS all-in-one)
├── archive.html        # Epoch 4 historical archive
├── stats.json          # Generated stats data (DO NOT edit manually)
├── stats-epoch4.json   # Frozen Epoch 4 snapshot for archive page
├── export_stats.py     # Script to generate stats.json from database
├── about.html          # About page
└── CLAUDE.md           # This file
```

Related project:
```
../telegram-bot/
├── payment_ledger.db   # SQLite database (source of truth)
│   ├── payments        # Current epoch data (Epoch 5)
│   └── payments_epoch4 # Archived Epoch 4 data (5,156 payments)
├── bot.py              # Telegram bot code
└── archive_epoch4.py   # Script to archive epochs (one-time use)
```

---

## Key Concepts

### Payment Types
- **reviewer**: Paid when someone reviews a video
- **project**: Paid to the CBAF project when video is approved
- **merchant**: Paid to the local merchant featured in the video

### Payment Flow
1. Video submitted -> reviewer gets paid (always)
2. If approved -> project AND merchant also get paid
3. If rejected -> only reviewer payment exists

### Stats Math
- **Videos** = count of reviewer payments
- **Approvals** = videos where project/merchant payments exist
- **Rejections** = videos - approvals
- **Expected payments** = (approvals x 3) + rejections

---

## Database Schema (payment_ledger.db)

```sql
payments (
    id INTEGER PRIMARY KEY,
    timestamp TEXT,           -- ISO format
    payment_type TEXT,        -- 'reviewer', 'project', or 'merchant'
    recipient_name TEXT,      -- Name with country flag emoji for projects
    lightning_address TEXT,   -- e.g., 'username@blink.sv'
    amount_sats INTEGER,
    tx_id TEXT,               -- Transaction ID from payment provider
    post_url TEXT,            -- URL to the video post (X or Nostr)
    audit_sheet_row INTEGER,
    synced_at TEXT
)
```

---

## Dashboard Components

### Summary Cards
1. **Top Performers (24h)** - Rolling 24h window, purple accent
2. **Total Payments** - All-time payment counts
3. **Approval Rate** - Percentage with approved/rejected breakdown
4. **Since Launch** - Days active and daily averages

### Today Banner
Orange highlighted banner showing today's stats.

### Today on X / Today on Nostr
Approved videos for the day, split by platform.

### Leaderboards
- **Top Projects** - Ranked by video count
- **Top Merchants** - Same format

### Charts
- Daily activity bar chart (30 days)
- Lightning providers pie chart
- Platform distribution pie chart

---

## Common Tasks

### Regenerate Stats
```bash
cd C:\Users\glenn\Documents\Vibes\powbot-stats
python export_stats.py
```

### Fix Missing Payment Record
```python
import sqlite3
conn = sqlite3.connect('../telegram-bot/payment_ledger.db')
cur = conn.cursor()
cur.execute('''
    INSERT INTO payments (timestamp, payment_type, recipient_name,
                         lightning_address, amount_sats, tx_id, post_url, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
''', (timestamp, payment_type, recipient_name, lightning_address,
      amount_sats, tx_id, post_url, synced_at))
conn.commit()
```

---

## Styling

Uses the Bitcoin Ubuntu design system. See `../.brain/BRAND.md` for the full spec.

Key accents:
- Orange: Bitcoin/Today banner
- Purple: Top performers, reviewers
- Green: Approved, merchants
- Blue: Projects

---

## Important Notes

1. **export_stats.py is gitignored** - Contains local database path
2. **Unicode handling** - Windows console can't print emoji flags, write to file instead
3. **Timezone** - All timestamps are UTC
4. **Platform detection** - URLs containing 'twitter.com' or 'x.com' = X, otherwise = Nostr
5. **Mobile hover states** - Use `@media (hover: hover)` to prevent sticky states

---

## Epochs

PoWBoT operates in epochs (formerly called "eras"). Each epoch represents a period of activity with its own data set.

### Historical Epochs (Hardcoded)
- **Epoch 1** (May 25): 81 approved posts
- **Epoch 2** (Aug 25): 298 approved posts
- **Epoch 3** (Nov 25): 604 approved posts
- **Epoch 4 Testing**: 187 approved posts (excludes 22 rejected + 1 duplicate merchant)
- **Epoch 4 Live**: 1,697 approved posts (Jan 13 - Mar 4, 2026)

**Total historical:** 2,867 approved posts

Note: Epoch 1-3 counts updated from CSV files (March 2026) - actual counts higher than originally documented.

### Current Epoch
- **Epoch 5** (Mar 26): Active (launching in next few days)

### Epoch Archiving Process

When transitioning to a new epoch:

1. **Archive database table:**
   ```bash
   cd telegram-bot
   python archive_epoch4.py  # One-time script
   ```
   - Renames `payments` → `payments_epoch4`
   - Creates fresh empty `payments` table
   - Preserves all other bot data intact

2. **Snapshot stats:**
   ```bash
   cd powbot-stats
   cp stats.json stats-epoch4.json  # Manual snapshot
   ```

3. **Update chart totals:**
   - Add completed epoch to hardcoded values in `renderEpochsChart()`
   - Update baseline total (currently 2,826)

### Archive Page

`archive.html` provides historical view of completed epochs:
- Loads from frozen `stats-epoch4.json` snapshot
- Simplified layout (no time-sensitive sections)
- Focus on leaderboards and historical insights

---

## Related

- **Main bot:** `../telegram-bot/`
- **Design system:** `../.brain/BRAND.md`
- **Master context:** `../CLAUDE.md`
