# Shared Includes System

This directory contains shared HTML fragments that are injected into pages to avoid repetition.

## Files

- **nav.html** - Common navigation bar
- **footer.html** - Common footer with support link
- **inject.js** - JavaScript that loads and injects nav/footer into pages

## Usage

In your HTML page, replace the `<nav>` and `<footer>` elements with:

```html
<!-- Navigation (loaded from includes/nav.html) -->
<div id="site-nav"></div>

<!-- Your page content here -->

<!-- Footer (loaded from includes/footer.html) -->
<div id="site-footer"></div>

<!-- Before closing </body> -->
<script src="includes/inject.js"></script>
</body>
```

## Features

- **Automatic current page highlighting** - The nav link for the current page gets the `.current` class
- **Support URL** - Centralized support contact at `https://t.me/bitcoinubuntu`
  - Available globally as `window.SUPPORT_URL` for use in other scripts
- **Dynamic timestamp** - Automatically adds timestamp element for stats page

## Migrated Pages

The following pages now use the includes system:
- index.html
- members.html
- archive.html
- about.html
- disclaimer.html
- profile.html
- profile-edit.html (footer only, nav is custom)

## Updating

To change navigation or footer across all pages, simply edit:
- `includes/nav.html` for navigation changes
- `includes/footer.html` for footer changes

Changes will automatically reflect on all pages using the includes system.

## Support Link

The support contact link is set to `https://t.me/bitcoinubuntu` and appears in:
- Footer (all pages)
- Profile editor error messages (when telegram_username is not configured)
