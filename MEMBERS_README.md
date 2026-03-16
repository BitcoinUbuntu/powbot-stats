# CBAF Members Directory

A Lightning donation-focused directory of CBAF (Circular Bitcoin Africa Fund) member projects, integrated with PoWBoT stats.

## 📁 Files Created

- **`generate_members.py`** - Data processing script
- **`members.json`** - Generated member profiles database
- **`members.html`** - Member directory (card grid view)
- **`profile.html`** - Individual member profile pages
- **`index.html`** - Updated with navigation to members (quick links section)

## 🚀 Quick Start

### Initial Setup

1. **Generate member data:**
   ```bash
   cd C:\Users\glenn\Documents\Vibes\powbot-stats
   python generate_members.py
   ```

   This will:
   - Read the CSV file with CBAF members
   - Parse the WordPress XML export for rich profile data
   - Match with PoWBoT stats from `stats-epoch4.json`
   - Output `members.json` with all combined data

2. **View the directory:**
   - Open `members.html` in your browser
   - Or navigate from the main `index.html` dashboard

### Adding/Updating Members

**Option 1: Update CSV + Regenerate (Easiest)**
1. Update `c:\Users\glenn\Downloads\PoW Public Tracker - CBAF Members.csv`
2. Run `python generate_members.py`
3. Commit and push `members.json`

**Option 2: Update XML + Regenerate (For Rich Data)**
1. Export fresh XML from bitcoinconfederation.org
2. Save as `c:\Users\glenn\Downloads\bitcoineconomyconfederation.xml.xml`
3. Run `python generate_members.py`
4. Commit and push `members.json`

**Option 3: Manual JSON Edit (Quick Fixes)**
1. Edit `members.json` directly
2. Commit and push

## 📊 Data Sources

### CSV Fields (Required)
- Project Name (with country in parentheses)
- Contact
- Email
- X Profile
- npub
- Lightning Address

### XML Fields (Optional Rich Data)
- Logo URL
- Cover image URL
- Tagline
- Description
- Country / City
- BTCMap URL
- Gallery images
- Vision & Mission
- How it started
- Milestones
- BTCPay campaign URL
- Onchain Bitcoin address

### PoWBoT Stats (Automatic)
- Epoch 4 video count
- Recent posts (up to 5)

## 🎨 Features

### Members Directory (`members.html`)
- Card-based grid layout
- Search by name, country, city, tagline
- Filters:
  - All Projects
  - Active on PoWBoT
  - Top Performers (50+ videos)
- Country dropdown filter
- Sort by activity or name
- Quick donate buttons (copies Lightning address)
- Activity badges (video counts, top performer badge)

### Profile Pages (`profile.html`)
- Hero section with cover image and logo
- Prominent donation section:
  - Lightning QR code (generated from address)
  - BTCPay campaign link
  - Onchain address
- About / Description
- PoWBoT Activity stats with recent posts
- Vision & Mission
- How it Started
- Milestones & Achievements
- Photo gallery
- Contact links (X, Nostr, Email, BTCMap)

## 🔧 Customization

### Update Epoch Data Source

When moving to Epoch 5+, update `generate_members.py`:

```python
# Line ~17: Change stats file path
STATS_PATH = Path(__file__).parent / "stats.json"  # Current epoch
# or
STATS_PATH = Path(__file__).parent / "stats-epoch5.json"  # Specific epoch
```

### Add New Data Fields

1. **Update XML parsing** in `parse_xml_profile()`:
   ```python
   elif key == '_your-new-field':
       profile['your_new_field'] = value
   ```

2. **Update empty field initialization** in `match_and_merge()`
3. **Update profile.html template** to display the new field

### Styling

Both pages use the Bitcoin Ubuntu design system:
- Colors defined in `:root` CSS variables
- Dark theme with neon accents
- Orange for primary actions (donate)
- Purple for top performers
- Blue for links/navigation

## 📝 Current Status

**Data Matching:**
- ✅ 25/39 members have XML profile data
- ✅ 26/39 members have PoWBoT activity
- ⚠️ 14 members missing XML profiles (will show with basic info only)

**Missing XML Profiles:**
- Bit-Fitness
- Bitfiasi Initiative
- Bitcoin Famba
- Bitcoin Githurai
- EcoBitz
- El Zera School
- Simply Sow
- Soweto BTC
- TofoBTC
- Tri-Bitcoin (name mismatch: "Tri Bitcoin" in XML)
- Volschenk Primary
- Women of Satoshi Cooperative

These members will still appear in the directory but with limited information (CSV data only).

## 🐛 Known Issues & Solutions

### Name Matching Issues

Some projects have different names in CSV vs XML:
- CSV: `Tri-Bitcoin (South Africa)`
- XML: `Tri Bitcoin` (no dash, no country)

**Solution:** Update either the CSV or XML to match, then regenerate.

### WordPress Serialized Arrays

Logo, cover, and gallery URLs are stored as PHP serialized arrays in the XML. The script parses these automatically, but if you see raw serialized data in the output, check the `parse_php_serialized_array()` function.

### Missing Images

If images don't load on profiles:
1. Check the URL in `members.json`
2. Verify the image exists on bitcoinconfederation.org
3. Check browser console for CORS or 404 errors

## 🚀 Future Enhancements

Potential features to add:

1. **Map View**
   - Interactive map using BTCMap locations
   - Cluster markers by country
   - Click pin to view profile

2. **Live PoWBoT Stats**
   - Auto-refresh from current epoch stats
   - Real-time video count updates
   - Activity graphs per project

3. **Profile Claiming**
   - Email verification
   - Web form for projects to update their own profiles
   - GitHub PR workflow for changes

4. **Advanced Filtering**
   - Filter by category (education, community, business)
   - Filter by region
   - Filter by establishment date

5. **Donation Analytics**
   - Track donation QR code scans
   - Show total sats raised (if possible)
   - Donation leaderboard

## 📞 Support

For issues or questions:
- Check this README first
- Review `generate_members.py` comments
- Contact Glenn or check project documentation in `.brain/` folder

---

Built with ❤️ using Bitcoin Ubuntu design system
