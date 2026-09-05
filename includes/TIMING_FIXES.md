# Timing Fixes for Includes System

## Issue
Pages that tried to access footer elements (like `#updated` timestamp) before `inject.js` loaded the footer would get "Cannot set properties of null" errors.

## Solution
For pages that access footer elements:
1. Load `inject.js` BEFORE the main page script
2. Add null checks when accessing footer elements
3. Use `window.includesLoaded.then()` to wait for includes to load before running main scripts

## Pages Fixed

### index.html (Stats Page)
- **Issue:** Tried to set `#updated` timestamp before footer loaded
- **Fix:**
  - Moved `inject.js` before main script
  - Added `window.includesLoaded.then(() => loadStats())`
  - Added null check for `#updated` element

### archive.html (Archive Page)
- **Issue:** Tried to set `#updated` timestamp before footer loaded
- **Fix:**
  - Moved `inject.js` before main script
  - Added `window.includesLoaded.then(() => loadStats())`
  - Added null check for `#updated` element

### profile.html (Profile Page)
- **Issue:** Tried to set `#updated` timestamp before footer loaded
- **Fix:**
  - Moved `inject.js` before main script
  - Added null check for `#updated` element
  - Note: Profile page can work without waiting since it has fallback logic

## Pages Not Affected

### members.html
- ✓ Safe - doesn't access footer elements

### about.html
- ✓ Safe - no inline scripts

### disclaimer.html
- ✓ Safe - no inline scripts

### profile-edit.html
- ✓ Safe - doesn't access footer elements

## Testing
All pages tested successfully at http://localhost:8000 with no timing errors on refresh.
