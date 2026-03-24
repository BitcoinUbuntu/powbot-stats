# Top Performers Mobile Navigation Issue

**Problem:** Top Performers (24h) links work perfectly on desktop but don't navigate on mobile. Mobile recognizes the tap (shows visual feedback) but doesn't follow the link.

**Current Code:**
- Uses `<a>` tags with dynamic href from `projectMetadata[project].info_url`
- HTML structure in `renderTopPerformers()` function around line 1598
- CSS hover effects around line 317-343

**Hover CSS (currently implemented):**
```css
a.top-performer-item:hover {
    background: rgba(163, 113, 247, 0.1);
    margin: 0 -8px;
    padding: 8px 8px;
    border-radius: 8px;
    transform: translateX(4px);
}
```

**Key Observations:**
1. View Profile buttons in leaderboards work perfectly on mobile using simple hover (background color change only, no margin/padding shifts)
2. Country tags also work perfectly on mobile with simple hover pattern
3. Top Performers have layout-shifting hover effects that may be triggered by mobile taps, potentially breaking navigation

**Attempts Made:**
- Wrapped hover in `@media (hover: hover)` - didn't work
- Added `pointer-events: none` to child spans - didn't work
- Added explicit click handlers - didn't work
- Simplified hover to match working patterns - lost polished look, still didn't work
- Touch device detection with conditional rendering - broke desktop too

**Files:**
- `index.html` - renderTopPerformers() function and CSS

**Goal:** Keep the polished desktop hover effects while making links work reliably on mobile.

**Working Patterns for Reference:**

Country tags CSS (works on mobile):
```css
.country-tag:hover {
    background: var(--accent-blue);
    color: white;
    transform: translateY(-2px);
}
```

View Profile buttons CSS (works on mobile):
```css
.view-profile-button a:hover {
    background: #79b8ff;
}
```
