# PoWBoT Stats Dashboard - Project Knowledge

## Overview
This is the public statistics dashboard for PoWBoT (Proof-of-Work Bot), a reward system for CBAF (Circular Bitcoin Economies of Africa Foundation) projects. The bot pays Bitcoin (sats via Lightning) to projects, merchants, and reviewers when videos promoting Bitcoin adoption in Africa are approved.

## Project Structure

```
powbot-stats/
├── index.html          # Main dashboard (HTML + CSS + JS all-in-one)
├── stats.json          # Generated stats data (DO NOT edit manually)
├── export_stats.py     # Script to generate stats.json from database
├── about.html          # About page
└── CLAUDE.md           # This file
```

Related project:
```
../telegram-bot/
├── payment_ledger.db   # SQLite database (source of truth)
└── bot.py              # Telegram bot code
```

## Key Concepts

### Payment Types
- **reviewer**: Paid when someone reviews a video (1000 sats)
- **project**: Paid to the CBAF project when video is approved (2100-4200 sats)
- **merchant**: Paid to the local merchant featured in the video (2100 sats)

### Payment Flow
1. Video submitted → reviewer gets paid (always)
2. If approved → project AND merchant also get paid
3. If rejected → only reviewer payment exists

### Stats Math
- **Videos** = count of reviewer payments
- **Approvals** = videos where project/merchant payments exist
- **Rejections** = videos - approvals
- **Expected payments** = (approvals × 3) + rejections

## Database Schema (payment_ledger.db)

```sql
payments (
    id INTEGER PRIMARY KEY,
    timestamp TEXT,           -- ISO format: 2026-01-21T14:30:00+00:00
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

## Dashboard Components

### Summary Cards (stats-grid)
1. **Top Performers (24h)** - Rolling 24h window, purple accent
2. **Total Payments** - All-time payment counts
3. **Approval Rate** - Percentage with approved/rejected breakdown
4. **Since Launch** - Days active and daily averages

### Today Banner
Orange highlighted banner showing today's stats:
- Videos (reviewer count)
- Approvals (green)
- Rejections (red)
- Payments (total)

### Today on X / Today on Nostr
Two cards showing approved videos for the day, split by platform.
- Limited to 5 initially, expandable
- Shows project name, merchant name, and time

### Leaderboards
- **Top Projects** - Ranked by video count, expandable to show posts
- **Top Merchants** - Same format

### Charts
- Daily activity bar chart (30 days)
- Lightning providers pie chart
- Platform distribution pie chart

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

### Fix Wrong post_url on Payment
```python
cur.execute('''
    UPDATE payments SET post_url = ? WHERE tx_id = ?
''', (correct_url, tx_id))
conn.commit()
```

### Debug Payment Discrepancies
```python
# Find posts with unusual payment counts
cur.execute('''
    SELECT post_url, COUNT(*) as cnt, GROUP_CONCAT(payment_type) as types
    FROM payments
    WHERE timestamp LIKE '2026-01-21%'
    GROUP BY post_url
    HAVING cnt != 3 AND cnt != 1
''')
```

## Styling Conventions

### CSS Variables
```css
--accent-orange: #f7931a;   /* Bitcoin orange, Today banner */
--accent-purple: #a371f7;   /* Top Performers, reviewers */
--accent-green: #3fb950;    /* Approved, merchants */
--accent-blue: #58a6ff;     /* Projects */
--bg-card: #161b22;
--border: #30363d;
```

### Card Styling
- Standard cards use `.card` class
- Special cards add modifier: `.card.top-performers`
- Purple accent uses gradient background + colored border + h2 color

## Git Workflow
- Main branch: `main`
- Working branch: `master`
- Commits should include: `Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>`
- Push stats.json updates after regenerating

## Important Notes

1. **export_stats.py is gitignored** - Contains local database path, changes stay local
2. **Unicode handling** - Windows console can't print emoji flags, write to file instead
3. **Timezone** - All timestamps are UTC
4. **Platform detection** - URLs containing 'twitter.com' or 'x.com' = X, otherwise = Nostr
5. **Flag stripping** - `strip_country_name()` removes "(Country)" but keeps flag emoji
6. **Mobile hover states** - Use `@media (hover: hover)` to prevent sticky states on touch

## Countries Mapping
Projects include country name and flag emoji, e.g., "BitKwa (Nigeria) 🇳🇬"
Full mapping is in `../telegram-bot/bot.py`
